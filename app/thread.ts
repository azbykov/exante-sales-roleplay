import type { Turn } from "@/lib/state";

/**
 * Which entry of the state trace belongs to the turn at `index`, or -1 when
 * there is none.
 *
 * The transcript interleaves both speakers and opens with the client's scripted
 * line; the trace has one entry per client reply that followed a salesperson
 * line. So the opening line has no state behind it — nothing has happened yet —
 * and every later client turn maps to the entry one behind its own ordinal.
 */
export function traceIndexOf(turns: Turn[], index: number): number {
  if (turns[index]?.role !== "assistant") return -1;

  let clientTurnsBefore = 0;
  for (let i = 0; i < index; i++) {
    if (turns[i].role === "assistant") clientTurnsBefore++;
  }
  return clientTurnsBefore - 1;
}
