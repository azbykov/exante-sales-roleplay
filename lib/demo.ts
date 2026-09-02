import "server-only";
import { TurnSchema, type AvatarTurn } from "./avatar";
import { ReportSchema, type Report } from "./evaluator";
import { DEMO_ACTIVE_TRADER } from "./content/demo/active-trader-switching";

/**
 * Demo mode: a recorded session instead of model calls.
 *
 * It exists for two things — showing the product without a key, and recording a
 * video where every run is identical. The recorded data passes the same schemas
 * as a live model response, so the mock cannot quietly drift out of sync: change
 * a schema and module loading fails, rather than the demo failing on camera.
 */

export type DemoSession = {
  scenarioId: string;
  /** Salesperson lines for the automatic run. */
  rmLines: string[];
  /** Avatar turns, one per salesperson line. */
  avatarTurns: AvatarTurn[];
  report: Report;
};

export const DEMO = process.env.NEXT_PUBLIC_DEMO === "1";

const SESSIONS: Record<string, DemoSession> = {
  [DEMO_ACTIVE_TRADER.scenarioId]: DEMO_ACTIVE_TRADER,
};

for (const session of Object.values(SESSIONS)) {
  session.avatarTurns.forEach((turn) => TurnSchema.parse(turn));
  ReportSchema.parse(session.report);

  if (session.rmLines.length !== session.avatarTurns.length) {
    throw new Error(`Demo ${session.scenarioId}: RM lines and avatar turns differ in count`);
  }
  const last = session.avatarTurns.at(-1);
  if (!last || last.state === "open") {
    throw new Error(`Demo ${session.scenarioId}: the session must end in a resolution`);
  }
}

export function demoLines(scenarioId: string): string[] {
  return SESSIONS[scenarioId]?.rmLines ?? [];
}

/** A pause so the recording shows waiting for a reply, not instant substitution. */
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function demoTurn(scenarioId: string, rmTurnIndex: number): Promise<AvatarTurn> {
  const session = SESSIONS[scenarioId];
  if (!session) throw new Error(`No recorded session for scenario ${scenarioId}`);

  // Improvisation beyond the recording is unsupported: replay the last turn.
  const turn = session.avatarTurns[Math.min(rmTurnIndex, session.avatarTurns.length - 1)];
  await pause(700);
  return turn;
}

export async function demoReport(scenarioId: string): Promise<Report> {
  const session = SESSIONS[scenarioId];
  if (!session) throw new Error(`No recorded session for scenario ${scenarioId}`);

  await pause(1200);
  return session.report;
}
