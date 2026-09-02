/**
 * Running the checks: npm run eval
 *
 * The regression here is not for code but for prompts, personas and the rubric —
 * that is where things break silently. Exact text is never compared: an LLM is
 * non-deterministic, so properties of the conversation are checked instead, and
 * anything arguable goes to the judge.
 *
 * Results are compared with the previous run (.eval/last.json).
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { PROBES } from "./probes";
import { DEFAULT_SCENARIO } from "../../lib/content/registry";
import { runProbe, type Status, type Verdict } from "./harness";
import { traceFor, transcriptFor } from "../../lib/evaluator";

const BASELINE = ".eval/last.json";
const MARK: Record<Status, string> = { pass: "ok  ", fail: "FAIL", warn: "warn", error: "ERR " };

/** Running a single probe: npm run eval -- pressure */
const FILTER = process.argv[2];
const SCENARIO = DEFAULT_SCENARIO;

async function evaluateProbe(probe: (typeof PROBES)[number]): Promise<Verdict> {
  try {
    const run = await runProbe(probe);
    const verdict = await probe.check(run, SCENARIO);

    // A single output line is not enough to diagnose a failure — save the transcript.
    if (verdict.status !== "pass") {
      mkdirSync(".eval", { recursive: true });
      writeFileSync(
        `.eval/${probe.id.replace(/\s+/g, "-")}.md`,
        [
          `# ${probe.id} — ${verdict.status}`,
          verdict.detail,
          ``,
          `Outcome: ${run.outcome}`,
          ``,
          `## Transcript`,
          transcriptFor(run.turns),
          ``,
          `## State trace`,
          traceFor(run.trace),
          ``,
          run.report ? `## Report\n\`\`\`json\n${JSON.stringify(run.report, null, 2)}\n\`\`\`` : "",
        ].join("\n"),
      );
    }
    return verdict;
  } catch (e) {
    return { status: "error", detail: e instanceof Error ? e.message : String(e) };
  }
}

function previous(): Record<string, Status> {
  try {
    return JSON.parse(readFileSync(BASELINE, "utf8"));
  } catch {
    return {};
  }
}

async function main() {
  const before = previous();
  const probes = FILTER ? PROBES.filter((p) => p.id.includes(FILTER)) : PROBES;
  const results = await Promise.all(
    probes.map(async (p) => ({ probe: p, verdict: await evaluateProbe(p) })),
  );

  for (const kind of ["general", "persona"] as const) {
    console.log(`\n${kind === "general" ? "General checks" : `Persona: ${SCENARIO.persona.name}`}`);
    for (const { probe, verdict } of results.filter((r) => r.probe.kind === kind)) {
      console.log(`  ${MARK[verdict.status]}  ${probe.id.padEnd(24)} ${verdict.detail}`);
    }
  }

  const tally = results.reduce<Record<string, number>>((acc, r) => {
    acc[r.verdict.status] = (acc[r.verdict.status] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`\n${Object.entries(tally).map(([k, v]) => `${v} ${k}`).join(", ")}`);

  const changes = results
    .filter(({ probe, verdict }) => before[probe.id] && before[probe.id] !== verdict.status)
    .map(({ probe, verdict }) => `  ${probe.id}: ${before[probe.id]} → ${verdict.status}`);
  if (changes.length) console.log(`\nChanges against the previous run:\n${changes.join("\n")}`);

  mkdirSync(".eval", { recursive: true });
  const updated = { ...before, ...Object.fromEntries(results.map((r) => [r.probe.id, r.verdict.status])) };
  writeFileSync(BASELINE, JSON.stringify(updated, null, 2));

  const broken = results.some((r) => r.verdict.status === "fail" || r.verdict.status === "error");
  process.exit(broken ? 1 : 0);
}

main();
