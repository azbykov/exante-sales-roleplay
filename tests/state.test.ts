import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  ClientStateSchema,
  ResolutionReasonSchema,
  resolutionMatchesState,
  type ConversationState,
  type ResolutionReason,
} from "../lib/state";

const STATES: ConversationState[] = ["open", "deal", "no_deal", "walkout"];
const REASONS = ResolutionReasonSchema.options;

/** The pairing the whole product leans on: an outcome and the reason for it. */
const ALLOWED: Record<ConversationState, ResolutionReason[]> = {
  open: [],
  deal: ["need_matched"],
  no_deal: ["no_clear_value", "patience_exhausted", "max_turns"],
  walkout: ["pressure", "compliance_violation", "patience_exhausted"],
};

describe("resolutionMatchesState", () => {
  test("open accepts no reason at all, and every other state requires one", () => {
    assert.equal(resolutionMatchesState("open", null), true);
    for (const reason of REASONS) {
      assert.equal(resolutionMatchesState("open", reason), false, `open + ${reason}`);
    }
    for (const state of ["deal", "no_deal", "walkout"] as const) {
      assert.equal(resolutionMatchesState(state, null), false, `${state} + null`);
    }
  });

  // Exhaustive rather than illustrative: this table is the contract, and a
  // spot check would let a single wrong pair through.
  test("every state/reason pair matches the table", () => {
    for (const state of STATES) {
      for (const reason of REASONS) {
        assert.equal(
          resolutionMatchesState(state, reason),
          ALLOWED[state].includes(reason),
          `${state} + ${reason}`,
        );
      }
    }
  });

  test("a deal can only ever be need_matched", () => {
    assert.deepEqual(
      REASONS.filter((reason) => resolutionMatchesState("deal", reason)),
      ["need_matched"],
    );
  });
});

describe("ClientStateSchema", () => {
  test("accepts the 1-5 integers the scales are defined on", () => {
    assert.equal(ClientStateSchema.safeParse({ trust: 1, interest: 3, patience: 5 }).success, true);
  });

  test("rejects anything off the scale", () => {
    for (const bad of [
      { trust: 0, interest: 3, patience: 3 },
      { trust: 6, interest: 3, patience: 3 },
      { trust: 2.5, interest: 3, patience: 3 },
      { trust: 3, interest: 3 },
      { trust: "3", interest: 3, patience: 3 },
    ]) {
      assert.equal(ClientStateSchema.safeParse(bad).success, false, JSON.stringify(bad));
    }
  });
});
