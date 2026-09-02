import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SCENARIO_ID } from "../lib/content/registry";
import { DEMO, demoLines } from "../lib/demo";
import { POST as openSession } from "../app/api/sessions/route";
import { DELETE as deleteSession, GET as readSession } from "../app/api/sessions/[sessionId]/route";
import { POST as postLine } from "../app/api/sessions/[sessionId]/turns/route";
import { POST as postReport } from "../app/api/sessions/[sessionId]/report/route";
import { GET as readScenarios } from "../app/api/scenarios/route";

/** The handlers are called directly: this checks the adapter layer, not the network. */
before(() => {
  assert.ok(DEMO, "run the tests with NEXT_PUBLIC_DEMO=1 (see the `test` script)");
});

const json = (body: unknown) =>
  new Request("http://test/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const raw = (body: string) =>
  new Request("http://test/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });

const ctx = (sessionId: string) => ({ params: Promise.resolve({ sessionId }) });

async function read(response: Response) {
  return { status: response.status, body: await response.json() };
}

async function open() {
  const { body } = await read(await openSession(json({ scenarioId: DEFAULT_SCENARIO_ID })));
  return body as { id: string };
}

describe("GET /api/scenarios", () => {
  test("returns the catalogue", async () => {
    const { status, body } = await read(await readScenarios());
    assert.equal(status, 200);
    assert.ok(Array.isArray(body) && body.length > 0);
  });
});

describe("POST /api/sessions", () => {
  test("opens a conversation and names it", async () => {
    const { status, body } = await read(await openSession(json({ scenarioId: DEFAULT_SCENARIO_ID })));
    assert.equal(status, 200);
    assert.ok(body.id);
    assert.equal(body.phase, "talking");
    assert.equal(body.turns.length, 1);
    await deleteSession(new Request("http://test/api"), ctx(body.id));
  });

  test("falls back to the default scenario when none is named", async () => {
    const { status, body } = await read(await openSession(json({})));
    assert.equal(status, 200);
    assert.equal(body.scenario.id, DEFAULT_SCENARIO_ID);
    await deleteSession(new Request("http://test/api"), ctx(body.id));
  });

  test("rejects a body that is not JSON", async () => {
    const { status, body } = await read(await openSession(raw("not json")));
    assert.equal(status, 400);
    assert.match(body.error, /not valid JSON/);
  });

  test("rejects a scenario that cannot be played", async () => {
    const { status, body } = await read(await openSession(json({ scenarioId: "systematic-fund-api" })));
    assert.equal(status, 400);
    assert.match(body.error, /Unknown scenario/);
  });

  test("rejects a malformed field with the field named", async () => {
    const { status, body } = await read(await openSession(json({ scenarioId: 42 })));
    assert.equal(status, 400);
    assert.match(body.error, /scenarioId/);
  });
});

describe("POST /api/sessions/:id/turns", () => {
  test("plays a line and returns the conversation", async () => {
    const session = await open();
    const { status, body } = await read(await postLine(json({ text: "How is it set up?" }), ctx(session.id)));
    assert.equal(status, 200);
    assert.equal(body.turns.length, 3);
    assert.equal(body.rmTurns, 1);
    await deleteSession(new Request("http://test/api"), ctx(session.id));
  });

  test("rejects an empty line", async () => {
    const session = await open();
    for (const text of ["", "   "]) {
      const { status } = await read(await postLine(json({ text }), ctx(session.id)));
      assert.equal(status, 400, JSON.stringify(text));
    }
    await deleteSession(new Request("http://test/api"), ctx(session.id));
  });

  test("rejects a line past the size cap", async () => {
    const session = await open();
    const { status, body } = await read(await postLine(json({ text: "x".repeat(4_001) }), ctx(session.id)));
    assert.equal(status, 400);
    assert.match(body.error, /text/);
    await deleteSession(new Request("http://test/api"), ctx(session.id));
  });

  test("an unknown session is a 404", async () => {
    const { status } = await read(await postLine(json({ text: "hi" }), ctx("no-such-session")));
    assert.equal(status, 404);
  });
});

describe("POST /api/sessions/:id/report", () => {
  test("refuses a conversation that has not resolved", async () => {
    const session = await open();
    const { status, body } = await read(await postReport(new Request("http://test/api"), ctx(session.id)));
    assert.equal(status, 400);
    assert.match(body.error, /has not reached a resolution/);
    await deleteSession(new Request("http://test/api"), ctx(session.id));
  });

  // The point of the whole session layer: the request has no field for an
  // outcome, so a failed conversation cannot be reported as a deal.
  test("takes no body, and scores the outcome the server recorded", async () => {
    const session = await open();
    let view;
    for (let i = 0; i < demoLines(DEFAULT_SCENARIO_ID).length; i++) {
      ({ body: view } = await read(await postLine(json({ text: `Line ${i + 1}.` }), ctx(session.id))));
      if (view.phase !== "talking") break;
    }
    assert.equal(view.phase, "resolved");

    const { status, body } = await read(await postReport(new Request("http://test/api"), ctx(session.id)));
    assert.equal(status, 200);
    assert.equal(body.phase, "debrief");
    assert.ok(body.report);
    assert.equal(body.report.dimensions.length, 3);
    await deleteSession(new Request("http://test/api"), ctx(session.id));
  });
});

describe("GET and DELETE /api/sessions/:id", () => {
  test("GET resumes the conversation — this is what a reload does", async () => {
    const session = await open();
    await postLine(json({ text: "How is it set up?" }), ctx(session.id));

    const { status, body } = await read(await readSession(new Request("http://test/api"), ctx(session.id)));
    assert.equal(status, 200);
    assert.equal(body.id, session.id);
    assert.equal(body.turns.length, 3);
    assert.equal(body.trace.length, 1);
    await deleteSession(new Request("http://test/api"), ctx(session.id));
  });

  test("DELETE ends it, and the id stops resolving", async () => {
    const session = await open();
    const removed = await deleteSession(new Request("http://test/api"), ctx(session.id));
    assert.equal(removed.status, 204);

    const { status } = await read(await readSession(new Request("http://test/api"), ctx(session.id)));
    assert.equal(status, 404);
  });

  test("an unknown id reads as a 404", async () => {
    const { status, body } = await read(await readSession(new Request("http://test/api"), ctx("nope")));
    assert.equal(status, 404);
    assert.match(body.error, /no longer open/);
  });
});
