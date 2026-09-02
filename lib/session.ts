import "server-only";
import { z } from "zod";
import { generateObject } from "ai";
import { model, toMessages } from "./llm";
import { TurnSchema, avatarSystemPrompt, clampState, type AvatarTurn } from "./avatar";
import {
  ReportSchema,
  evaluatorSystemPrompt,
  evaluatorTaskPrompt,
  type Report,
} from "./evaluator";
import {
  ClientStateSchema,
  OutcomeSchema,
  ResolutionReasonSchema,
  type ClientState,
  type Outcome,
  type ResolutionReason,
  type Turn,
} from "./state";
import { DEMO, demoLines, demoReport, demoTurn } from "./demo";
import { RequestError } from "./errors";
import type { Scenario } from "./scenario";

/**
 * The two things the product does — play a turn, and evaluate a finished
 * conversation — in one place.
 *
 * The HTTP routes are adapters over these functions and scripts/eval calls the
 * very same code. When the loop lived in both places, `npm run eval` was
 * checking a copy of the production path rather than the path itself, and a fix
 * in one copy never reached the other.
 */

/**
 * Structural limits, applied before the scenario is known: they bound the
 * request, not the exercise. The per-scenario limit is maxTurns, enforced in
 * runTurn.
 */
const MAX_CONTENT_CHARS = 4_000;
const MAX_LIST_LENGTH = 200;

const TurnListSchema = z
  .array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().min(1).max(MAX_CONTENT_CHARS),
    }),
  )
  .min(1)
  .max(MAX_LIST_LENGTH);

const TraceSchema = z.array(ClientStateSchema).max(MAX_LIST_LENGTH);

export const TurnRequestSchema = z.object({
  scenarioId: z.string().min(1).max(200).optional(),
  turns: TurnListSchema,
  trace: TraceSchema.default([]),
});

export const ReportRequestSchema = z.object({
  scenarioId: z.string().min(1).max(200).optional(),
  turns: TurnListSchema,
  outcome: OutcomeSchema,
  resolutionReason: ResolutionReasonSchema,
  trace: TraceSchema.default([]),
});

/**
 * The avatar's opening line is static and lives in the system prompt, so the
 * history handed to the model must start with the salesperson.
 */
function historyOf(turns: Turn[]): Turn[] {
  return turns[0]?.role === "assistant" ? turns.slice(1) : turns;
}

export async function runTurn(
  scenario: Scenario,
  turns: Turn[],
  trace: ClientState[] = [],
): Promise<AvatarTurn> {
  const history = historyOf(turns);
  const rmTurns = history.filter((t) => t.role === "user").length;

  if (rmTurns === 0) {
    throw new RequestError("The conversation must continue with a salesperson line");
  }
  // maxTurns is enforced here rather than only asked for in the prompt: past the
  // limit there is nothing left to play, and every further turn is a paid call.
  if (rmTurns > scenario.maxTurns) {
    throw new RequestError(
      `This scenario is limited to ${scenario.maxTurns} salesperson lines; the conversation has ended`,
    );
  }

  if (DEMO) {
    if (!demoLines(scenario.id).length) {
      throw new RequestError(`Demo mode has no recorded session for scenario ${scenario.id}`);
    }
    return demoTurn(scenario.id, rmTurns - 1);
  }

  const currentState = trace.at(-1) ?? scenario.persona.initialState;
  const forceResolution = rmTurns >= scenario.maxTurns;

  const { object } = await generateObject({
    model: model("avatar"),
    schema: TurnSchema,
    system: avatarSystemPrompt(scenario, { currentState, forceResolution }),
    messages: toMessages(history),
    reasoning: "low", // a conversational line: speed matters more than depth
  });

  const turn = { ...object, client: clampState(currentState, object.client) };

  // The same discipline as clampState: forceResolution is a request to the model,
  // so the guarantee that the conversation actually lands belongs in code.
  if (forceResolution && turn.state === "open") {
    console.warn(
      `runTurn: the model left the conversation open at turn ${rmTurns}/${scenario.maxTurns}, landing it as no_deal`,
    );
    return { ...turn, state: "no_deal", resolutionReason: "max_turns" };
  }

  return turn;
}

export async function runReport(
  scenario: Scenario,
  turns: Turn[],
  outcome: Outcome,
  resolutionReason: ResolutionReason,
  trace: ClientState[] = [],
): Promise<Report> {
  if (DEMO) {
    if (!demoLines(scenario.id).length) {
      throw new RequestError(`Demo mode has no recorded session for scenario ${scenario.id}`);
    }
    return demoReport(scenario.id);
  }

  const { object } = await generateObject({
    model: model("evaluator"),
    schema: ReportSchema,
    system: evaluatorSystemPrompt(),
    reasoning: "high", // evaluation is the core of the product; no savings here
    prompt: evaluatorTaskPrompt(scenario, turns, outcome, resolutionReason, trace),
  });
  return object;
}
