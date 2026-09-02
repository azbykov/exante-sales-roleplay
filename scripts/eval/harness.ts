import { z } from "zod";
import { generateObject, generateText } from "ai";
import { model } from "../../lib/llm";
import { runReport, runTurn } from "../../lib/session";
import { transcriptFor, type Report } from "../../lib/evaluator";
import type {
  ClientState,
  ConversationState,
  Outcome as Resolved,
  ResolutionReason,
  Turn,
} from "../../lib/state";
import type { Scenario } from "../../lib/scenario";
import { DEFAULT_SCENARIO } from "../../lib/content/registry";

export type Status = "pass" | "fail" | "warn" | "error";
export type StateKey = "trust" | "interest" | "patience";
export type Outcome = ConversationState;

export type Run = {
  turns: Turn[];
  trace: ClientState[];
  outcome: Outcome;
  resolutionReason: ResolutionReason | null;
  report: Report | null;
};

export type Verdict = { status: Status; detail: string };

export type Probe = {
  id: string;
  kind: "general" | "persona";
  /** System prompt for the synthetic salesperson. */
  rm: string;
  /**
   * Verbatim lines instead of generation. Needed wherever a probe must contain a
   * specific breach: the salesperson model refuses to promise returns (the
   * provider's safety training), and without a script we would be testing someone
   * else's constraints rather than our own rubric.
   */
  lines?: string[];
  maxRmTurns: number;
  needsReport: boolean;
  check: (run: Run, scenario: Scenario) => Promise<Verdict> | Verdict;
};

const JudgeSchema = z.object({ pass: z.boolean(), reason: z.string() });

/**
 * The judge is for what cannot be checked by comparing strings:
 * "did the avatar stay in role", "did the hidden need surface".
 */
export async function judge(question: string, turns: Turn[]): Promise<Verdict> {
  const { object } = await generateObject({
    model: model("evaluator"),
    schema: JudgeSchema,
    reasoning: "low",
    system:
      "You are checking the behaviour of an AI avatar playing a client in a sales simulator. " +
      "Answer strictly the question asked, using the transcript only. Give the reason in one sentence.",
    prompt: `Question: ${question}\n\nTranscript:\n${transcriptFor(turns)}`,
  });
  return { status: object.pass ? "pass" : "fail", detail: object.reason };
}

async function rmReply(rmPrompt: string, turns: Turn[]): Promise<string> {
  // Roles are mirrored: for the synthetic salesperson the client's lines are user messages.
  const mirrored = turns.map((t) => ({
    role: t.role === "user" ? ("assistant" as const) : ("user" as const),
    content: t.content,
  }));
  const { text } = await generateText({
    model: model("avatar"),
    reasoning: "low",
    system: `${rmPrompt}\nAnswer in English, 1-3 sentences, no lists.`,
    messages: mirrored,
  });
  return text;
}

export async function runProbe(
  probe: Probe,
  scenario: Scenario = DEFAULT_SCENARIO,
): Promise<Run> {
  let turns: Turn[] = [{ role: "assistant", content: scenario.openingLine }];
  const trace: ClientState[] = [];
  let outcome: Outcome = "open";
  let resolutionReason: ResolutionReason | null = null;
  let rmTurns = 0;

  // The probe drives runTurn and runReport — the same functions the API routes
  // call — so a change to the dialogue loop cannot pass the checks unnoticed.
  while (outcome === "open" && rmTurns < Math.min(probe.maxRmTurns, scenario.maxTurns)) {
    const line = probe.lines?.[Math.min(rmTurns, probe.lines.length - 1)];
    turns = [...turns, { role: "user", content: line ?? (await rmReply(probe.rm, turns)) }];
    rmTurns++;
    const turn = await runTurn(scenario, turns, trace);
    turns = [...turns, { role: "assistant", content: turn.reply }];
    trace.push(turn.client);
    outcome = turn.state;
    resolutionReason = turn.resolutionReason;
  }

  const base = { turns, trace, outcome, resolutionReason };
  const report =
    probe.needsReport && outcome !== "open"
      ? await runReport(scenario, turns, outcome as Resolved, resolutionReason!, trace)
      : null;
  return { ...base, report };
}

/**
 * The shift of state against a baseline. Needed by single-reply probes:
 * maxJump compares adjacent turns and always returns 0 for a single turn.
 */
export function drift(from: ClientState, to: ClientState): Record<StateKey, number> {
  return {
    trust: to.trust - from.trust,
    interest: to.interest - from.interest,
    patience: to.patience - from.patience,
  };
}

/** How sharply the client's state jumps: a measure of the avatar's discipline. */
const STATE_KEYS: StateKey[] = ["trust", "interest", "patience"];

export function maxJump(trace: ClientState[]): number {
  let max = 0;
  for (let i = 1; i < trace.length; i++) {
    for (const k of STATE_KEYS) {
      max = Math.max(max, Math.abs(trace[i][k] - trace[i - 1][k]));
    }
  }
  return max;
}
