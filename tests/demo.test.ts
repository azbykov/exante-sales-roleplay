import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { TurnSchema } from "../lib/avatar";
import { ReportSchema } from "../lib/evaluator";
import { DEMO_ACTIVE_TRADER } from "../lib/content/demo/active-trader-switching";
import { demoLines, demoReport, demoTurn } from "../lib/demo";

/**
 * The recorded session is a fixture in two places at once: it is what demo mode
 * plays instead of the model, and it is what these tests run the dialogue loop
 * against. Either way it has to pass the same schemas a live answer does, or the
 * mock quietly drifts away from the product it stands in for.
 */
describe("the recorded session", () => {
  test("every recorded turn is a valid avatar turn", () => {
    for (const [i, turn] of DEMO_ACTIVE_TRADER.avatarTurns.entries()) {
      assert.equal(TurnSchema.safeParse(turn).success, true, `turn ${i}`);
    }
  });

  test("the recorded report is a valid report", () => {
    assert.equal(ReportSchema.safeParse(DEMO_ACTIVE_TRADER.report).success, true);
  });

  test("has one avatar turn per salesperson line", () => {
    assert.equal(DEMO_ACTIVE_TRADER.rmLines.length, DEMO_ACTIVE_TRADER.avatarTurns.length);
  });

  test("ends in a resolution, so the demo always reaches a debrief", () => {
    const last = DEMO_ACTIVE_TRADER.avatarTurns.at(-1);
    assert.ok(last && last.state !== "open");
    assert.ok(last.resolutionReason);
  });

  test("the report agrees with the outcome the recording ends on", () => {
    const last = DEMO_ACTIVE_TRADER.avatarTurns.at(-1);
    assert.equal(DEMO_ACTIVE_TRADER.report.outcome, last?.state);
    assert.equal(DEMO_ACTIVE_TRADER.report.resolutionReason, last?.resolutionReason);
  });
});

describe("replaying it", () => {
  const id = DEMO_ACTIVE_TRADER.scenarioId;

  test("hands back the turn for each salesperson line in order", async () => {
    for (const [i, expected] of DEMO_ACTIVE_TRADER.avatarTurns.entries()) {
      assert.equal((await demoTurn(id, i)).reply, expected.reply, `turn ${i}`);
    }
  });

  test("improvisation past the recording repeats the last turn", async () => {
    const last = DEMO_ACTIVE_TRADER.avatarTurns.at(-1);
    assert.equal((await demoTurn(id, 99)).reply, last?.reply);
  });

  test("a scenario with no recording says so", async () => {
    assert.deepEqual(demoLines("systematic-fund-api"), []);
    await assert.rejects(() => demoTurn("systematic-fund-api", 0), /No recorded session/);
    await assert.rejects(() => demoReport("systematic-fund-api"), /No recorded session/);
  });
});
