import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { traceIndexOf } from "../app/thread";
import { withPendingLine, withoutPendingLine } from "../app/optimistic";
import type { PublicSession } from "../lib/catalogue";
import type { Turn } from "../lib/state";

/** A conversation as it comes back from the server: opening line, then pairs. */
const conversation: Turn[] = [
  { role: "assistant", content: "Good afternoon." },
  { role: "user", content: "How is your trading set up?" },
  { role: "assistant", content: "Two brokers." },
  { role: "user", content: "How much time does that cost?" },
  { role: "assistant", content: "A couple of hours a month." },
];

describe("traceIndexOf", () => {
  // The opening line is scripted: nothing has happened, so there is no state
  // behind it and no chips are drawn under it.
  test("the client's opening line has no state behind it", () => {
    assert.equal(traceIndexOf(conversation, 0), -1);
  });

  test("salesperson turns never carry state", () => {
    assert.equal(traceIndexOf(conversation, 1), -1);
    assert.equal(traceIndexOf(conversation, 3), -1);
  });

  test("each later client reply maps to its own trace entry, in order", () => {
    assert.equal(traceIndexOf(conversation, 2), 0);
    assert.equal(traceIndexOf(conversation, 4), 1);
  });

  test("an index past the transcript has nothing to map", () => {
    assert.equal(traceIndexOf(conversation, 99), -1);
  });

  test("the mapping stays aligned while a salesperson line is pending", () => {
    const pending = [...conversation, { role: "user", content: "And the API?" } as Turn];
    assert.equal(traceIndexOf(pending, 2), 0);
    assert.equal(traceIndexOf(pending, 4), 1);
    assert.equal(traceIndexOf(pending, 5), -1);
  });
});

const session = (turns: Turn[]): PublicSession => ({
  id: "s1",
  scenario: {} as PublicSession["scenario"],
  phase: "talking",
  turns,
  trace: [],
  report: null,
  startedAt: 0,
  endedAt: null,
  rmTurns: 0,
  maxTurns: 14,
});

describe("the pending salesperson line", () => {
  test("appears at the end of the transcript straight away", () => {
    const shown = withPendingLine(session(conversation), "And the API?");
    assert.equal(shown.turns.length, conversation.length + 1);
    assert.deepEqual(shown.turns.at(-1), { role: "user", content: "And the API?" });
  });

  test("does not mutate the session it was given", () => {
    const before = session(conversation);
    withPendingLine(before, "And the API?");
    assert.equal(before.turns.length, conversation.length);
  });

  test("is taken back when the request fails", () => {
    const shown = withPendingLine(session(conversation), "And the API?");
    assert.deepEqual(withoutPendingLine(shown).turns, conversation);
  });

  /**
   * The invariant the rollback rests on: the avatar replies to every line, so a
   * server-confirmed transcript always ends with the client. Anything trailing
   * from the salesperson is the pending line and nothing else.
   */
  test("leaves a confirmed transcript alone", () => {
    const confirmed = session(conversation);
    assert.equal(withoutPendingLine(confirmed), confirmed);
  });

  test("takes back only one line, however often it is called", () => {
    const shown = withPendingLine(session(conversation), "And the API?");
    const once = withoutPendingLine(shown);
    assert.deepEqual(withoutPendingLine(once).turns, conversation);
  });
});
