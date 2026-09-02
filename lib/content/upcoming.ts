import type { UpcomingPersona } from "../scenario";

/**
 * Personas announced in the catalogue but not yet playable.
 *
 * They are deliberately not registered in SCENARIOS: without a scenario there is
 * no hidden need, no objections and no resolution conditions, so there is
 * nothing for the avatar to play. getScenario() does not know these ids, which
 * means /api/turn refuses them on its own — the disabled button in the UI is an
 * affordance, not the thing that enforces it.
 *
 * Turning one of these into an exercise means writing a Persona and a
 * ScenarioArtifact and moving the id into the registry; the entry here then goes.
 */
export const UPCOMING: UpcomingPersona[] = [
  {
    id: "adviser-consolidating-clients",
    name: "Sofia Marchetti",
    headline: "34, independent financial adviser from Milan",
    brief:
      "She called after a referral and is genuinely interested — which is the trap. An open " +
      "client makes it easy to skip straight to the feature list instead of finding out how she " +
      "actually runs her clients' portfolios today.",
    traits: ["open to the call", "asks broad questions", "decides slowly"],
    difficulty: 1,
  },
  {
    id: "corporate-treasury-account",
    name: "Viktor Halász",
    headline: "52, CFO of a logistics group in Budapest",
    brief:
      "A corporate account, so the decision is not his alone. He measures counterparty risk, " +
      "audit trail and who signs what, and he will not be moved by anything said about " +
      "commissions or execution speed.",
    traits: ["thinks in process", "needs a paper trail", "answers to a board"],
    difficulty: 2,
  },
  {
    id: "systematic-fund-api",
    name: "Priya Raman",
    headline: "36, runs a two-person systematic fund in Singapore",
    brief:
      "She took the call to end it. Only the API, the fills and the margin model interest her, " +
      "and any sentence that sounds like a pitch costs the salesperson the rest of the " +
      "conversation.",
    traits: ["treats the call as overhead", "wants specifics only", "knows the market"],
    difficulty: 3,
  },
];
