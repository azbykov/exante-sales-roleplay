import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { apiError, badRequest, firstIssue } from "./errors";

/**
 * Routes are adapters: parse the body, call the domain, map the failure. These
 * two helpers are the whole of that, so a handler stays a handful of lines and
 * no route invents its own error shape.
 */

export async function parse<S extends z.ZodType>(
  req: Request,
  schema: S,
): Promise<{ ok: true; data: z.infer<S> } | { ok: false; response: NextResponse }> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { ok: false, response: badRequest("The request body is not valid JSON") };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, response: badRequest(`Malformed request — ${firstIssue(parsed.error)}`) };
  }
  return { ok: true, data: parsed.data };
}

export async function handle<T>(work: () => Promise<T>): Promise<NextResponse> {
  try {
    return NextResponse.json(await work());
  } catch (e) {
    const { message, status } = apiError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
