import { z } from "zod";

/**
 * The vocabulary shared by the server and the browser: the client's state, the
 * set of outcomes and the reasons for them.
 *
 * It holds no prompts and no scenario content, which is what lets it cross into
 * a client component while lib/avatar.ts, lib/evaluator.ts and the content
 * registry stay marked `server-only`.
 */

export const ClientStateSchema = z.object({
  trust: z.number().int().min(1).max(5),
  interest: z.number().int().min(1).max(5),
  patience: z.number().int().min(1).max(5),
});

export type ClientState = z.infer<typeof ClientStateSchema>;

export const ConversationStateSchema = z.enum(["open", "deal", "no_deal", "walkout"]);
export type ConversationState = z.infer<typeof ConversationStateSchema>;

/** The three ways a conversation can end; `open` is not one of them. */
export const OutcomeSchema = z.enum(["deal", "no_deal", "walkout"]);
export type Outcome = z.infer<typeof OutcomeSchema>;

export const ResolutionReasonSchema = z.enum([
  "need_matched",
  "no_clear_value",
  "pressure",
  "compliance_violation",
  "patience_exhausted",
  "max_turns",
]);

export type ResolutionReason = z.infer<typeof ResolutionReasonSchema>;

export function resolutionMatchesState(
  state: ConversationState,
  reason: ResolutionReason | null,
): boolean {
  switch (state) {
    case "open":
      return reason === null;
    case "deal":
      return reason === "need_matched";
    case "no_deal":
      return (
        reason === "no_clear_value" ||
        reason === "patience_exhausted" ||
        reason === "max_turns"
      );
    case "walkout":
      return (
        reason === "pressure" ||
        reason === "compliance_violation" ||
        reason === "patience_exhausted"
      );
  }
}

export const STATE_LABELS: Record<keyof ClientState, string> = {
  trust: "trust",
  interest: "interest",
  patience: "patience",
};

/** RM lines travel as user messages, avatar lines as assistant messages. */
export type Turn = { role: "user" | "assistant"; content: string };
