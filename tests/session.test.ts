import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SCENARIO } from "../lib/content/registry";
import {
  buildDebrief,
  createSession,
  endSession,
  loadSession,
  playLine,
  publicSession,
  runTurn,
} from "../lib/session";
import type { Turn } from "../lib/state";
import { DEMO, demoLines } from "../lib/demo";

/**
 * These run in demo mode: the recorded session stands in for the model, so the
 * dialogue loop, the store and the guards are exercised end to end without a
 * network call and without a non-deterministic answer. It is the same code path
 * a live conversation takes — only the source of the reply differs.
 */
before(() => {
  assert.ok(DEMO, "run the tests with NEXT_PUBLIC_DEMO=1 (see the `test` script)");
});

const SCENARIO = DEFAULT_SCENARIO.id;
const RECORDED = demoLines(SCENARIO).length;

async function playToResolution() {
  const opened = await createSession(SCENARIO);
  let session = opened;
  for (let i = 0; i < RECORDED; i++) {
    session = await playLine(session.id, `Line ${i + 1}.`);
    if (session.outcome) break;
  }
  return session;
}

describe("opening a session", () => {
  test("starts with the client's scripted line and nothing else", async () => {
    const session = await createSession(SCENARIO);
    assert.deepEqual(session.turns, [
      { role: "assistant", content: DEFAULT_SCENARIO.openingLine },
    ]);
    assert.deepEqual(session.trace, []);
    assert.equal(session.outcome, null);
    assert.equal(session.report, null);
    await endSession(session.id);
  });

  test("gives each conversation its own id", async () => {
    const a = await createSession(SCENARIO);
    const b = await createSession(SCENARIO);
    assert.notEqual(a.id, b.id);
    await endSession(a.id);
    await endSession(b.id);
  });

  test("refuses a scenario that is not registered", async () => {
    await assert.rejects(() => createSession("systematic-fund-api"), /Unknown scenario/);
  });
});

describe("loading a session", () => {
  test("an unknown id is a 404, not a server fault", async () => {
    await assert.rejects(
      () => loadSession("00000000-0000-0000-0000-000000000000"),
      (err: { status?: number }) => err.status === 404,
    );
  });

  test("an ended session is gone", async () => {
    const session = await createSession(SCENARIO);
    await endSession(session.id);
    await assert.rejects(() => loadSession(session.id), /no longer open/);
  });
});

describe("playing a line", () => {
  test("appends both speakers and extends the trace by one", async () => {
    const opened = await createSession(SCENARIO);
    const after = await playLine(opened.id, "How is your trading set up today?");

    assert.equal(after.turns.length, 3);
    assert.equal(after.turns[1].role, "user");
    assert.equal(after.turns[1].content, "How is your trading set up today?");
    assert.equal(after.turns[2].role, "assistant");
    assert.equal(after.trace.length, 1);
    await endSession(after.id);
  });

  // The invariant the optimistic line in the interface depends on.
  test("a confirmed transcript always ends with the client", async () => {
    const opened = await createSession(SCENARIO);
    let session = opened;
    for (let i = 0; i < 3; i++) {
      session = await playLine(session.id, `Line ${i + 1}.`);
      assert.equal(session.turns.at(-1)?.role, "assistant", `after line ${i + 1}`);
    }
    await endSession(session.id);
  });

  test("records the outcome the avatar declared, with a matching reason", async () => {
    const session = await playToResolution();
    assert.ok(session.outcome, "the recorded session is expected to resolve");
    assert.ok(session.resolutionReason);
    assert.ok(session.endedAt && session.endedAt >= session.startedAt);
    await endSession(session.id);
  });

  test("a resolved conversation takes no more lines", async () => {
    const session = await playToResolution();
    await assert.rejects(() => playLine(session.id, "One more."), /already ended/);
    await endSession(session.id);
  });

  test("lines for one session are serialised rather than raced", async () => {
    const opened = await createSession(SCENARIO);
    const results = await Promise.allSettled([
      playLine(opened.id, "First."),
      playLine(opened.id, "Second."),
    ]);

    const session = await loadSession(opened.id);
    const rmLines = session.turns.filter((t) => t.role === "user").map((t) => t.content);
    // Both were accepted, in order, each extending the transcript the other left.
    assert.deepEqual(rmLines, ["First.", "Second."]);
    assert.equal(session.turns.length, 5);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 2);
    await endSession(opened.id);
  });
});

describe("building the debrief", () => {
  test("refuses a conversation that has not resolved", async () => {
    const opened = await createSession(SCENARIO);
    await assert.rejects(() => buildDebrief(opened.id), /has not reached a resolution/);
    await endSession(opened.id);
  });

  test("scores the conversation and keeps the outcome the server recorded", async () => {
    const played = await playToResolution();
    const done = await buildDebrief(played.id);

    assert.ok(done.report);
    assert.equal(done.report.outcome, played.outcome);
    assert.equal(done.report.resolutionReason, played.resolutionReason);
    assert.equal(done.report.dimensions.length, 3);
    await endSession(done.id);
  });

  test("asking twice returns the same report rather than paying for a second", async () => {
    const played = await playToResolution();
    const first = await buildDebrief(played.id);
    const second = await buildDebrief(played.id);
    assert.equal(first.report, second.report);
    await endSession(played.id);
  });
});

describe("the view handed to the browser", () => {
  test("reports the phase the screens route on", async () => {
    const opened = await createSession(SCENARIO);
    assert.equal(publicSession(opened).phase, "talking");

    const played = await playToResolution();
    assert.equal(publicSession(played).phase, "resolved");

    const done = await buildDebrief(played.id);
    assert.equal(publicSession(done).phase, "debrief");

    await endSession(opened.id);
    await endSession(done.id);
  });

  test("counts salesperson lines against the scenario's limit", async () => {
    const opened = await createSession(SCENARIO);
    const view = publicSession(opened);
    assert.equal(view.rmTurns, 0);
    assert.equal(view.maxTurns, DEFAULT_SCENARIO.maxTurns);

    const after = await playLine(opened.id, "One line.");
    assert.equal(publicSession(after).rmTurns, 1);
    await endSession(opened.id);
  });

  test("carries the public scenario card and none of the answers", async () => {
    const opened = await createSession(SCENARIO);
    const serialised = JSON.stringify(publicSession(opened));
    for (const key of ["hiddenNeed", "manner", "resolution", "objections"]) {
      assert.equal(serialised.includes(key), false, `${key} reached the browser`);
    }
    assert.equal(publicSession(opened).scenario.persona.name, DEFAULT_SCENARIO.persona.name);
    await endSession(opened.id);
  });
});

describe("the turn limit", () => {
  /**
   * maxTurns is enforced against the stored transcript, not asked for in the
   * prompt. Past the limit there is nothing left to play, and every further turn
   * would be a paid model call.
   */
  const transcript = (rmLines: number): Turn[] => {
    const turns: Turn[] = [{ role: "assistant", content: DEFAULT_SCENARIO.openingLine }];
    for (let i = 0; i < rmLines; i++) {
      turns.push({ role: "user", content: `Line ${i + 1}.` });
      turns.push({ role: "assistant", content: "Go on." });
    }
    return turns;
  };

  test("accepts the last line the scenario allows", async () => {
    const upToLimit = transcript(DEFAULT_SCENARIO.maxTurns - 1);
    upToLimit.push({ role: "user", content: "The closing line." });
    const turn = await runTurn(DEFAULT_SCENARIO, upToLimit, []);
    assert.ok(turn.reply.length > 0);
  });

  test("refuses the one after it", async () => {
    const past = transcript(DEFAULT_SCENARIO.maxTurns);
    past.push({ role: "user", content: "One too many." });
    await assert.rejects(
      () => runTurn(DEFAULT_SCENARIO, past, []),
      /limited to 14 salesperson lines/,
    );
  });

  test("refuses a transcript with no salesperson line to answer", async () => {
    await assert.rejects(
      () => runTurn(DEFAULT_SCENARIO, transcript(0), []),
      /must continue with a salesperson line/,
    );
  });
});
