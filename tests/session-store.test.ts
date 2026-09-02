import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { memoryStore, type StoredSession } from "../lib/session-store";

const make = (id: string, updatedAt = Date.now()): StoredSession => ({
  id,
  scenarioId: "active-trader-switching",
  startedAt: updatedAt,
  updatedAt,
  endedAt: null,
  turns: [{ role: "assistant", content: "Good afternoon." }],
  trace: [],
  outcome: null,
  resolutionReason: null,
  report: null,
});

describe("the in-process session store", () => {
  test("saves and reads back a session", async () => {
    const session = make("store-roundtrip");
    await memoryStore.save(session);
    assert.equal((await memoryStore.get("store-roundtrip"))?.id, "store-roundtrip");
    await memoryStore.remove("store-roundtrip");
  });

  test("an unknown id is undefined rather than an error", async () => {
    assert.equal(await memoryStore.get("never-existed"), undefined);
  });

  test("remove is final, and safe to repeat", async () => {
    await memoryStore.save(make("store-remove"));
    await memoryStore.remove("store-remove");
    await memoryStore.remove("store-remove");
    assert.equal(await memoryStore.get("store-remove"), undefined);
  });

  test("saving stamps updatedAt, so an active session does not age out", async () => {
    const session = make("store-touch", Date.now() - 60_000);
    await memoryStore.save(session);
    assert.ok(session.updatedAt > Date.now() - 5_000);
    await memoryStore.remove("store-touch");
  });

  // A conversation is minutes long; a day-old one is abandoned, not resumable.
  test("a session older than the TTL is gone, and is not handed back", async () => {
    const stale = make("store-stale", Date.now() - 7 * 60 * 60 * 1000);
    await memoryStore.save(stale);
    stale.updatedAt = Date.now() - 7 * 60 * 60 * 1000; // save() refreshed it; age it back
    assert.equal(await memoryStore.get("store-stale"), undefined);
  });
});
