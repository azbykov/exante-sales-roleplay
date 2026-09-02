import type { ClientState, Turn } from "./state";
import type { Report } from "./evaluator";

/**
 * What the browser is allowed to know about the content: the shape of the
 * projection returned by listScenarios().
 *
 * It lives here rather than in lib/content/registry.ts because that module is
 * `server-only` — the registry decides what to expose, this file describes what
 * arrives.
 */

/** What every card in the catalogue shows, playable or not. */
export type PersonaCard = {
  id: string;
  name: string;
  headline: string;
  brief: string;
  traits: string[];
};

export type ReadyScenario = {
  status: "ready";
  id: string;
  version: string;
  difficulty: 1 | 2 | 3;
  persona: PersonaCard & { version: string; hint: string; initialState: ClientState };
  openingLine: string;
  /** Non-empty only in demo mode: the salesperson's recorded lines. */
  demoLines: string[];
};

/** Announced, with no scenario behind it yet: there is nothing to start. */
export type UpcomingScenario = {
  status: "coming_soon";
  id: string;
  difficulty: 1 | 2 | 3;
  persona: PersonaCard;
};

/**
 * The union is what keeps the disabled button honest: everything that starts a
 * conversation takes a ReadyScenario, so an upcoming card cannot be passed to it
 * even by mistake.
 */
export type CatalogueEntry = ReadyScenario | UpcomingScenario;

/**
 * A conversation as the browser sees it: an id, and everything the server is
 * willing to show about the session behind it. The transcript, the state trace
 * and the outcome are the server's — this is a view of them, not the copy the
 * client plays from.
 */
export type SessionPhase = "talking" | "resolved" | "debrief";

export type PublicSession = {
  id: string;
  scenario: ReadyScenario;
  phase: SessionPhase;
  turns: Turn[];
  trace: ClientState[];
  report: Report | null;
  startedAt: number;
  endedAt: number | null;
  rmTurns: number;
  maxTurns: number;
};

/**
 * Where each screen lives. A conversation is addressed by its session id, so a
 * URL names one specific conversation rather than the scenario it was played on.
 */
export const routes = {
  picker: "/",
  chat: (sessionId: string) => `/s/${encodeURIComponent(sessionId)}`,
  debrief: (sessionId: string) => `/s/${encodeURIComponent(sessionId)}/debrief`,
};

export const api = {
  scenarios: "/api/scenarios",
  sessions: "/api/sessions",
  session: (id: string) => `/api/sessions/${encodeURIComponent(id)}`,
  turns: (id: string) => `/api/sessions/${encodeURIComponent(id)}/turns`,
  report: (id: string) => `/api/sessions/${encodeURIComponent(id)}/report`,
};
