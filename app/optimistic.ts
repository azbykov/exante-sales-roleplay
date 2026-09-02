import type { PublicSession } from "@/lib/catalogue";

/**
 * The salesperson's line, shown before the server has seen it.
 *
 * A turn is a model call and takes seconds; waiting for it to echo the line back
 * makes the interface feel like it swallowed what was typed.
 *
 * Taking the line back on failure is safe because of an invariant the server
 * guarantees: a confirmed transcript always ends with the client, since the
 * avatar replies to every line. A trailing salesperson turn is therefore the
 * pending one and nothing else.
 */
export function withPendingLine(session: PublicSession, text: string): PublicSession {
  return { ...session, turns: [...session.turns, { role: "user", content: text }] };
}

export function withoutPendingLine(session: PublicSession): PublicSession {
  if (session.turns.at(-1)?.role !== "user") return session;
  return { ...session, turns: session.turns.slice(0, -1) };
}
