import { NextResponse } from "next/server";
import { DEFAULT_SCENARIO_ID, getScenario } from "@/lib/content/registry";
import { ReportRequestSchema, runReport } from "@/lib/session";
import { apiError, badRequest, firstIssue } from "@/lib/errors";

/** An adapter over runReport: parse the request, call the domain, map the failure. */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("The request body is not valid JSON");
  }

  const parsed = ReportRequestSchema.safeParse(body);
  if (!parsed.success) return badRequest(`Malformed request — ${firstIssue(parsed.error)}`);

  const scenarioId = parsed.data.scenarioId ?? DEFAULT_SCENARIO_ID;
  const scenario = getScenario(scenarioId);
  if (!scenario) return badRequest(`Unknown scenario: ${scenarioId}`);

  const { turns, outcome, resolutionReason, trace } = parsed.data;

  try {
    return NextResponse.json(await runReport(scenario, turns, outcome, resolutionReason, trace));
  } catch (e) {
    const { message, status } = apiError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
