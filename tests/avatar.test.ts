import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { TurnSchema, clampState } from "../lib/avatar";
import type { ClientState } from "../lib/state";

const state = (trust: number, interest: number, patience: number): ClientState => ({
  trust,
  interest,
  patience,
});

const turn = (over: Record<string, unknown> = {}) => ({
  reply: "Mostly US equities, around forty trades a month.",
  client: state(3, 3, 4),
  state: "open",
  resolutionReason: null,
  ...over,
});

describe("TurnSchema", () => {
  test("accepts an open turn with no reason", () => {
    assert.equal(TurnSchema.safeParse(turn()).success, true);
  });

  test("rejects an open turn that carries a reason anyway", () => {
    const result = TurnSchema.safeParse(turn({ resolutionReason: "max_turns" }));
    assert.equal(result.success, false);
  });

  test("rejects a finished turn with no reason", () => {
    assert.equal(TurnSchema.safeParse(turn({ state: "deal" })).success, false);
  });

  test("rejects a reason that contradicts the outcome", () => {
    assert.equal(
      TurnSchema.safeParse(turn({ state: "deal", resolutionReason: "pressure" })).success,
      false,
    );
    assert.equal(
      TurnSchema.safeParse(turn({ state: "walkout", resolutionReason: "need_matched" })).success,
      false,
    );
  });

  test("accepts each outcome with a reason that fits it", () => {
    for (const [outcome, reason] of [
      ["deal", "need_matched"],
      ["no_deal", "no_clear_value"],
      ["no_deal", "max_turns"],
      ["walkout", "pressure"],
      ["walkout", "compliance_violation"],
    ] as const) {
      const result = TurnSchema.safeParse(turn({ state: outcome, resolutionReason: reason }));
      assert.equal(result.success, true, `${outcome} + ${reason}`);
    }
  });

  test("rejects an empty reply: the client always says something", () => {
    assert.equal(TurnSchema.safeParse(turn({ reply: "" })).success, false);
  });
});

describe("clampState", () => {
  test("leaves a move inside the band alone", () => {
    assert.deepEqual(clampState(state(3, 3, 3), state(4, 1, 5)), state(4, 1, 5));
  });

  test("clamps a move of more than two points, in both directions", () => {
    assert.deepEqual(clampState(state(3, 3, 3), state(5, 1, 3)), state(5, 1, 3));
    assert.deepEqual(clampState(state(4, 4, 4), state(1, 1, 1)), state(2, 2, 2));
    assert.deepEqual(clampState(state(1, 1, 1), state(5, 5, 5)), state(3, 3, 3));
  });

  test("never leaves the 1-5 scale when clamping near an edge", () => {
    const clamped = clampState(state(1, 5, 2), state(5, 1, 5));
    assert.deepEqual(clamped, state(3, 3, 4));
    for (const value of Object.values(clamped)) {
      assert.ok(value >= 1 && value <= 5, `${value} off the scale`);
    }
  });

  test("returns a new object rather than mutating the previous state", () => {
    const previous = state(3, 3, 3);
    clampState(previous, state(5, 5, 5));
    assert.deepEqual(previous, state(3, 3, 3));
  });
});
