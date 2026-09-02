/**
 * The rubric is an artifact too. The score is defended by three things:
 * 1) fixed scale anchors (a score means the same thing across sessions),
 * 2) a mandatory quote as evidence for every dimension,
 * 3) compliance pulled out of the average into a separate flag.
 */

export type Dimension = {
  id: "discovery" | "objection" | "accuracy";
  title: string;
  question: string;
  anchors: Record<1 | 3 | 5, string>;
};

export const DIMENSIONS: Dimension[] = [
  {
    id: "discovery",
    title: "Discovery",
    question:
      "Did the salesperson establish how the client's work is set up and what actually gets in his way before starting to sell?",
    anchors: {
      1: "Started pitching immediately, asked nothing about the client.",
      3: "Asked general questions but never got to the real cause of the pain.",
      5: "Established specifics (which venues, how many trades, what gets in the way today) and built the conversation on them.",
    },
  },
  {
    id: "objection",
    title: "Objection handling",
    question:
      "What did the salesperson do with the objection: accept it and reframe it into a conversation about value — or defend, argue, ignore?",
    anchors: {
      1: "Defended himself, argued or changed the subject.",
      3: "Answered on the merits but never turned the objection into an argument.",
      5: "Clarified what stood behind the objection and reframed it into value for this client.",
    },
  },
  {
    id: "accuracy",
    title: "Accuracy about the product",
    question:
      "How specific and correct are the salesperson's claims about the product — no invented characteristics and no promises of gain?",
    anchors: {
      1: "Invented product characteristics, stated terms that contradict the facts, or promised returns or guarantees.",
      3: "Spoke in generalities, substituting judgements like \"one of the best\" for specifics.",
      5: "Relied on product properties that match the facts and did not gloss over risk.",
    },
  },
];

/** Breaches that must not be averaged with the rest: raised as a separate flag. */
export const COMPLIANCE_RULES = [
  "Promising returns, profit or a guarantee that funds are safe",
  "Claiming that trading is risk-free or that the risk is negligible",
  "False or invented claims about licences, regulators and the protection of funds",
];
