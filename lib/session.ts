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
import type { ClientState, Outcome, ResolutionReason, Turn } from "./state";
import { DEMO, demoLines, demoReport, demoTurn } from "./demo";
import { RequestError } from "./errors";
import { getScenario, publicScenario, type PublicScenario } from "./content/registry";
import { store, type StoredSession } from "./session-store";
import type { Scenario } from "./scenario";

/**
 * What the product does, in one place: play a turn, evaluate a finished
 * conversation, and hold the conversation in between.
 *
 * The HTTP routes are adapters over these functions and scripts/eval calls the
 * same runTurn and runReport. When the loop lived in both places, `npm run eval`
 * was checking a copy of the production path rather than the path itself, and a
 * fix in one copy never reached the other.
 */

/** One salesperson line. The transcript it joins is the server's, not the caller's. */
export const MAX_LINE_CHARS = 4_000;

export const LineSchema = z.object({
  text: z.string().trim().min(1).max(MAX_LINE_CHARS),
});

export const NewSessionSchema = z.object({
  scenarioId: z.string().min(1).max(200).optional(),
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

// --- The session: the conversation as the server holds it ---

/** What the browser is told about a session. Nothing here is a secret it did not already see. */
export type SessionPhase = "talking" | "resolved" | "debrief";

export type PublicSession = {
  id: string;
  scenario: PublicScenario;
  phase: SessionPhase;
  turns: Turn[];
  trace: ClientState[];
  report: Report | null;
  startedAt: number;
  endedAt: number | null;
  rmTurns: number;
  maxTurns: number;
};

function phaseOf(session: StoredSession): SessionPhase {
  if (session.report) return "debrief";
  return session.outcome ? "resolved" : "talking";
}

export function publicSession(session: StoredSession): PublicSession {
  const scenario = publicScenario(session.scenarioId);
  if (!scenario) throw new Error(`Session ${session.id} references unknown scenario`);

  return {
    id: session.id,
    scenario,
    phase: phaseOf(session),
    turns: session.turns,
    trace: session.trace,
    report: session.report,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    rmTurns: historyOf(session.turns).filter((t) => t.role === "user").length,
    maxTurns: getScenario(session.scenarioId)?.maxTurns ?? 0,
  };
}

/**
 * Turns for one session run one at a time. Reading the transcript, calling the
 * model and writing the result back is read-modify-write, and two lines sent at
 * once would otherwise each extend the transcript they started from.
 */
const chains = new Map<string, Promise<unknown>>();

function serialize<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = chains.get(key) ?? Promise.resolve();
  const result = previous.then(task, task);
  const tail = result.then(
    () => undefined,
    () => undefined,
  );
  chains.set(key, tail);
  void tail.then(() => {
    if (chains.get(key) === tail) chains.delete(key);
  });
  return result;
}

function requireScenarioFor(session: StoredSession): Scenario {
  const scenario = getScenario(session.scenarioId);
  if (!scenario) throw new Error(`Session ${session.id} references unknown scenario`);
  return scenario;
}

export async function createSession(scenarioId: string): Promise<StoredSession> {
  const scenario = getScenario(scenarioId);
  if (!scenario) throw new RequestError(`Unknown scenario: ${scenarioId}`);

  const now = Date.now();
  const session: StoredSession = {
    id: crypto.randomUUID(),
    scenarioId: scenario.id,
    startedAt: now,
    updatedAt: now,
    endedAt: null,
    // The avatar speaks first, and that line is fixed by the scenario.
    turns: [{ role: "assistant", content: scenario.openingLine }],
    trace: [],
    outcome: null,
    resolutionReason: null,
    report: null,
  };
  await store.save(session);
  return session;
}

/** The session, or a 404 — an id that is gone is not a server fault. */
export async function loadSession(id: string): Promise<StoredSession> {
  const session = await store.get(id);
  if (!session) {
    throw new RequestError("This session is no longer open. Start a new one.", 404);
  }
  return session;
}

export async function endSession(id: string): Promise<void> {
  await store.remove(id);
}

/** One salesperson line, played against the transcript the server holds. */
export async function playLine(id: string, text: string): Promise<StoredSession> {
  return serialize(id, async () => {
    const session = await loadSession(id);
    if (session.outcome) {
      throw new RequestError("This conversation has already ended.");
    }

    const scenario = requireScenarioFor(session);
    const turns: Turn[] = [...session.turns, { role: "user", content: text }];
    const turn = await runTurn(scenario, turns, session.trace);

    session.turns = [...turns, { role: "assistant", content: turn.reply }];
    session.trace = [...session.trace, turn.client];

    // The outcome is recorded from what the avatar declared. It is never sent by
    // the client and never taken from it, which is what makes the debrief's
    // "fixed outcome" worth fixing.
    if (turn.state !== "open" && turn.resolutionReason) {
      session.outcome = turn.state;
      session.resolutionReason = turn.resolutionReason;
      session.endedAt = Date.now();
    }

    await store.save(session);
    return session;
  });
}

/** The debrief for a conversation the server saw end. Safe to call again after a failure. */
export async function buildDebrief(id: string): Promise<StoredSession> {
  return serialize(id, async () => {
    const session = await loadSession(id);
    if (session.report) return session;
    if (!session.outcome || !session.resolutionReason) {
      throw new RequestError("This conversation has not reached a resolution yet.");
    }

    const scenario = requireScenarioFor(session);
    session.report = await runReport(
      scenario,
      session.turns,
      session.outcome,
      session.resolutionReason,
      session.trace,
    );
    await store.save(session);
    return session;
  });
}
