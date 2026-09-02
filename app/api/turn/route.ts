import { NextResponse } from "next/server";
import { DEFAULT_SCENARIO_ID, getScenario } from "@/lib/content/registry";
import { TurnRequestSchema, runTurn } from "@/lib/session";
import { apiError, badRequest, firstIssue } from "@/lib/errors";

/** An adapter over runTurn: parse the request, call the domain, map the failure. */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("The request body is not valid JSON");
  }

  const parsed = TurnRequestSchema.safeParse(body);
  if (!parsed.success) return badRequest(`Malformed request — ${firstIssue(parsed.error)}`);

  const scenarioId = parsed.data.scenarioId ?? DEFAULT_SCENARIO_ID;
  const scenario = getScenario(scenarioId);
  if (!scenario) return badRequest(`Unknown scenario: ${scenarioId}`);

  try {
    return NextResponse.json(await runTurn(scenario, parsed.data.turns, parsed.data.trace));
  } catch (e) {
    const { message, status } = apiError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
