import { NextResponse } from "next/server";
import { endSession, loadSession, publicSession } from "@/lib/session";
import { handle } from "@/lib/http";

type Context = { params: Promise<{ sessionId: string }> };

/** The conversation so far — this is what makes a reload and a shared link work. */
export async function GET(_req: Request, ctx: Context) {
  const { sessionId } = await ctx.params;
  return handle(async () => publicSession(await loadSession(sessionId)));
}

export async function DELETE(_req: Request, ctx: Context) {
  const { sessionId } = await ctx.params;
  await endSession(sessionId);
  return new NextResponse(null, { status: 204 });
}
