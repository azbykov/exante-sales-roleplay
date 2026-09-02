import { buildDebrief, publicSession } from "@/lib/session";
import { handle } from "@/lib/http";

type Context = { params: Promise<{ sessionId: string }> };

/**
 * The debrief. It takes no body: the outcome the evaluator is told to keep is
 * the one the avatar declared and the server recorded, not one the caller sent.
 */
export async function POST(_req: Request, ctx: Context) {
  const { sessionId } = await ctx.params;
  return handle(async () => publicSession(await buildDebrief(sessionId)));
}
