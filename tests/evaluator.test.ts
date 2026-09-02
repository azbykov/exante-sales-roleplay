import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { ReportSchema, transcriptFor, traceFor } from "../lib/evaluator";
import type { Turn } from "../lib/state";

const dimension = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  observed: true,
  score: 4,
  evidence: "Which venues do you trade on today?",
  comment: "Asked before offering.",
  ...over,
});

const report = (over: Record<string, unknown> = {}) => ({
  outcome: "deal",
  resolutionReason: "need_matched",
  turningPoint: { quote: "I will give you no guarantees.", speaker: "rm", why: "Named the downside." },
  recommendation: "Ask what he pays per contract today.",
  dimensions: [dimension("discovery"), dimension("objection"), dimension("accuracy")],
  compliance: { violated: false, quote: "", rule: "" },
  ...over,
});

describe("ReportSchema", () => {
  test("accepts a well-formed report", () => {
    assert.equal(ReportSchema.safeParse(report()).success, true);
  });

  test("requires exactly one of each dimension", () => {
    const duplicated = [dimension("discovery"), dimension("discovery"), dimension("accuracy")];
    assert.equal(ReportSchema.safeParse(report({ dimensions: duplicated })).success, false);

    const short = [dimension("discovery"), dimension("objection")];
    assert.equal(ReportSchema.safeParse(report({ dimensions: short })).success, false);
  });

  test("rejects a resolution reason that contradicts the outcome", () => {
    assert.equal(
      ReportSchema.safeParse(report({ outcome: "walkout", resolutionReason: "need_matched" })).success,
      false,
    );
  });

  test("an observed dimension cannot go without a score or a quote", () => {
    for (const broken of [{ score: null }, { evidence: "" }, { evidence: "   " }]) {
      const dims = [dimension("discovery", broken), dimension("objection"), dimension("accuracy")];
      assert.equal(
        ReportSchema.safeParse(report({ dimensions: dims })).success,
        false,
        JSON.stringify(broken),
      );
    }
  });

  // A missing opportunity must not be scored at all: this is what stops the
  // evaluator from filling a gap with a neutral three.
  test("an unobserved dimension takes no score and no quote", () => {
    const absent = dimension("accuracy", { observed: false, score: null, evidence: "" });
    const dims = [dimension("discovery"), dimension("objection"), absent];
    assert.equal(ReportSchema.safeParse(report({ dimensions: dims })).success, true);

    const scored = dimension("accuracy", { observed: false, score: 3, evidence: "" });
    assert.equal(
      ReportSchema.safeParse(report({ dimensions: [dimension("discovery"), dimension("objection"), scored] }))
        .success,
      false,
    );
  });

  test("a compliance breach needs both a quote and the rule it breaks", () => {
    assert.equal(
      ReportSchema.safeParse(report({ compliance: { violated: true, quote: "", rule: "x" } })).success,
      false,
    );
    assert.equal(
      ReportSchema.safeParse(report({ compliance: { violated: true, quote: "Guaranteed 15%.", rule: "Promising returns" } }))
        .success,
      true,
    );
  });

  test("without a breach the flag carries nothing", () => {
    assert.equal(
      ReportSchema.safeParse(report({ compliance: { violated: false, quote: "Guaranteed 15%.", rule: "" } }))
        .success,
      false,
    );
  });

  test("scores stay on the 1-5 scale", () => {
    for (const score of [0, 6, 3.5]) {
      const dims = [dimension("discovery", { score }), dimension("objection"), dimension("accuracy")];
      assert.equal(ReportSchema.safeParse(report({ dimensions: dims })).success, false, `${score}`);
    }
  });
});

describe("prompt formatting", () => {
  const turns: Turn[] = [
    { role: "assistant", content: "Good afternoon." },
    { role: "user", content: "How is your trading set up?" },
    { role: "assistant", content: "Two brokers." },
  ];

  test("the transcript labels speakers and numbers every line", () => {
    assert.equal(
      transcriptFor(turns),
      "[0] Client: Good afternoon.\n[1] RM: How is your trading set up?\n[2] Client: Two brokers.",
    );
  });

  test("the trace is numbered by salesperson line, starting at one", () => {
    const rendered = traceFor([
      { trust: 2, interest: 3, patience: 4 },
      { trust: 3, interest: 4, patience: 4 },
    ]);
    assert.equal(
      rendered,
      "after RM line #1: trust 2, interest 3, patience 4\nafter RM line #2: trust 3, interest 4, patience 4",
    );
  });

  test("an empty trace says so instead of rendering nothing", () => {
    assert.equal(traceFor([]), "(trace unavailable)");
  });
});
