import { LineSchema, playLine, publicSession } from "@/lib/session";
import { handle, parse } from "@/lib/http";

type Context = { params: Promise<{ sessionId: string }> };

/** One salesperson line. The request carries the line and nothing else. */
export async function POST(req: Request, ctx: Context) {
  const { sessionId } = await ctx.params;
  const body = await parse(req, LineSchema);
  if (!body.ok) return body.response;

  return handle(async () => publicSession(await playLine(sessionId, body.data.text)));
}
