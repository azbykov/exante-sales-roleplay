import "server-only";
import { NextResponse } from "next/server";
import { NoObjectGeneratedError } from "ai";
import type { z } from "zod";

/**
 * A fault in the request itself, not in the server: a malformed body, an unknown
 * scenario, a conversation past its turn limit. Kept apart from model and
 * gateway failures so the caller is told what to fix instead of "try again".
 */
export class RequestError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "RequestError";
    this.status = status;
  }
}

/** Gateway errors arrive wrapped in retries — unwrap down to the status code. */
function statusOf(e: unknown): number | undefined {
  let cur = e as { statusCode?: number; lastError?: unknown; cause?: unknown } | undefined;
  for (let depth = 0; cur && depth < 5; depth++) {
    if (typeof cur.statusCode === "number") return cur.statusCode;
    cur = (cur.lastError ?? cur.cause) as typeof cur;
  }
  return undefined;
}

/** A readable message instead of a stack trace: the simulator must not fail silently. */
export function apiError(e: unknown): { message: string; status: number } {
  // A bad request is the caller's business and not an incident: no stack in the log.
  if (e instanceof RequestError) return { message: e.message, status: e.status };

  console.error(e);

  if (NoObjectGeneratedError.isInstance(e)) {
    return { message: "The model returned an unparsable response", status: 502 };
  }

  switch (statusOf(e)) {
    case 401:
      return { message: "The gateway key is missing or invalid (AI_GATEWAY_API_KEY)", status: 401 };
    case 403:
      return { message: "The selected model is not available on the current gateway plan", status: 403 };
    case 429:
      return { message: "Rate limit reached — try again later", status: 429 };
    default:
      return { message: "Unexpected server error", status: 500 };
  }
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

/**
 * The first schema issue as "path: message". Enough for a caller to fix the
 * request, and it echoes back zod's own wording rather than the input.
 */
export function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "the body does not match the expected shape";
  const path = issue.path.join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}
