import { DEFAULT_SCENARIO_ID } from "@/lib/content/registry";
import { NewSessionSchema, createSession, publicSession } from "@/lib/session";
import { handle, parse } from "@/lib/http";

/** Opens a conversation and hands back its id. The transcript stays here. */
export async function POST(req: Request) {
  const body = await parse(req, NewSessionSchema);
  if (!body.ok) return body.response;

  return handle(async () =>
    publicSession(await createSession(body.data.scenarioId ?? DEFAULT_SCENARIO_ID)),
  );
}
