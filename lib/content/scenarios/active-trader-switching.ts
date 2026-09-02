import type { ScenarioArtifact } from "../../scenario";

export const ACTIVE_TRADER_SWITCHING = {
  id: "active-trader-switching",
  version: "1.0.0",
  personaId: "andreas-keller",
  difficulty: 2,
  product:
    "An EXANTE brokerage account: one multi-currency account with direct access to 50+ exchanges " +
    "(equities, ETFs, bonds, futures, options, currencies), unified margin across asset classes, " +
    "licences in the EU and the UK. The entry threshold is markedly higher than at retail brokers.",
  objections: [
    {
      trigger: "price / commissions",
      line: "Your commissions are higher than what I pay now. Why would I pay more?",
    },
    {
      trigger: "reliability / regulation",
      line: "This is the first I've heard of you. Who regulates you and where is my money held?",
    },
    {
      trigger: "migration",
      line: "Even if all of that is true — I'm not moving the portfolio, that's a week of hassle.",
    },
    {
      trigger: "testing for promises",
      line: "And how much better will I be doing if I move to you?",
    },
  ],
  resolution: {
    deal:
      "The salesperson uncovered the real pain (two brokers, split margin and reporting), tied it " +
      "to a specific capability of the product and proposed a clear next step. Then the client " +
      "agrees to demo access or a meeting.",
    noDeal:
      "The conversation ran its course, but the client saw no reason to change brokers. He " +
      "declines politely and suggests coming back later.",
    walkout:
      "The salesperson promised returns or a guarantee, dodged a direct question about regulation " +
      "twice, or started pushing. The client cuts the conversation short.",
  },
  openingLine:
    "Good afternoon. You wrote to me about an EXANTE account. I have about ten minutes — what did you want to offer?",
  maxTurns: 14,
} satisfies ScenarioArtifact;
