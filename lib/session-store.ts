import "server-only";
import type { Report } from "./evaluator";
import type { ClientState, Outcome, ResolutionReason, Turn } from "./state";

/**
 * Where a conversation lives while it is being played.
 *
 * The transcript, the state trace and the outcome belong to the server. The
 * browser holds a session id and nothing else, so a reload keeps the
 * conversation, a link addresses one specific conversation, and the outcome the
 * evaluator is given is the one the avatar declared rather than one the client
 * sent back.
 *
 * The implementation below keeps sessions in the process. That is enough for a
 * single instance and for the slice, and it is deliberately behind an interface:
 * on a serverless deployment, where each request may reach a different instance,
 * this is the one file to replace with Redis or Vercel KV. Nothing above it
 * knows the difference.
 */

export type StoredSession = {
  id: string;
  scenarioId: string;
  startedAt: number;
  updatedAt: number;
  /** When the avatar declared a resolution. */
  endedAt: number | null;
  turns: Turn[];
  trace: ClientState[];
  outcome: Outcome | null;
  resolutionReason: ResolutionReason | null;
  report: Report | null;
};

export interface SessionStore {
  get(id: string): Promise<StoredSession | undefined>;
  save(session: StoredSession): Promise<void>;
  remove(id: string): Promise<void>;
}

/** A practice conversation is minutes long; anything older is abandoned. */
const TTL_MS = 6 * 60 * 60 * 1000;
const MAX_SESSIONS = 500;

type WithSessions = typeof globalThis & { __sessions?: Map<string, StoredSession> };

// Survives hot reload in development: without this every edit drops live sessions.
const sessions: Map<string, StoredSession> = ((globalThis as WithSessions).__sessions ??= new Map());

function evict() {
  const cutoff = Date.now() - TTL_MS;
  for (const [id, session] of sessions) {
    if (session.updatedAt < cutoff) sessions.delete(id);
  }
  if (sessions.size <= MAX_SESSIONS) return;

  // Still over the cap: drop the least recently touched first.
  const oldest = [...sessions.values()]
    .sort((a, b) => a.updatedAt - b.updatedAt)
    .slice(0, sessions.size - MAX_SESSIONS);
  for (const session of oldest) sessions.delete(session.id);
}

export const memoryStore: SessionStore = {
  async get(id) {
    const session = sessions.get(id);
    if (!session) return undefined;
    if (session.updatedAt < Date.now() - TTL_MS) {
      sessions.delete(id);
      return undefined;
    }
    return session;
  },

  async save(session) {
    session.updatedAt = Date.now();
    sessions.set(session.id, session);
    evict();
  },

  async remove(id) {
    sessions.delete(id);
  },
};

export const store: SessionStore = memoryStore;
