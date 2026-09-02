import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { RequestError, apiError, firstIssue } from "../lib/errors";

describe("RequestError", () => {
  test("is a 400 by default: the caller's business, not a server fault", () => {
    assert.deepEqual(apiError(new RequestError("Unknown scenario: x")), {
      message: "Unknown scenario: x",
      status: 400,
    });
  });

  test("carries its own status when the fault is a missing thing", () => {
    assert.deepEqual(apiError(new RequestError("This session is no longer open.", 404)), {
      message: "This session is no longer open.",
      status: 404,
    });
  });
});

describe("apiError", () => {
  test("maps gateway statuses to something a reader can act on", () => {
    for (const [statusCode, expected] of [
      [401, 401],
      [403, 403],
      [429, 429],
    ] as const) {
      const mapped = apiError(Object.assign(new Error("gateway"), { statusCode }));
      assert.equal(mapped.status, expected);
      assert.ok(mapped.message.length > 0);
    }
  });

  // Gateway failures arrive wrapped in retries; the status is buried.
  test("unwraps a status nested behind lastError and cause", () => {
    const nested = Object.assign(new Error("outer"), {
      lastError: Object.assign(new Error("inner"), { statusCode: 429 }),
    });
    assert.equal(apiError(nested).status, 429);

    const deeper = Object.assign(new Error("outer"), {
      cause: Object.assign(new Error("middle"), {
        cause: Object.assign(new Error("inner"), { statusCode: 403 }),
      }),
    });
    assert.equal(apiError(deeper).status, 403);
  });

  test("anything unrecognised is a 500 with no stack leaked", () => {
    const mapped = apiError(new Error("something odd at /Users/someone/secret.ts"));
    assert.equal(mapped.status, 500);
    assert.equal(mapped.message, "Unexpected server error");
  });
});

describe("firstIssue", () => {
  const schema = z.object({ turns: z.array(z.object({ role: z.enum(["user", "assistant"]) })) });

  test("names the field so a caller knows what to fix", () => {
    const result = schema.safeParse({ turns: "hello" });
    assert.equal(result.success, false);
    if (!result.success) assert.match(firstIssue(result.error), /^turns: /);
  });

  test("names a nested field by path", () => {
    const result = schema.safeParse({ turns: [{ role: "system" }] });
    assert.equal(result.success, false);
    if (!result.success) assert.match(firstIssue(result.error), /^turns\.0\.role: /);
  });

  test("falls back to the message when the issue is on the body itself", () => {
    const result = z.string().safeParse(42);
    assert.equal(result.success, false);
    if (!result.success) assert.ok(firstIssue(result.error).length > 0);
  });
});
