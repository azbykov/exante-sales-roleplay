import type { Persona } from "../../scenario";

export const ANDREAS_KELLER = {
  id: "andreas-keller",
  version: "1.0.0",
  name: "Andreas Keller",
  headline: "41, active private trader from Munich",
  context: [
    "Trades US equities and options, around 40 trades a month",
    "Portfolio of roughly €350,000, currently held at a large retail broker",
    "Took the call himself after an email — curious but sceptical",
  ],
  brief:
    "He agreed to the call himself, but he will not buy a general presentation: every claimed " +
    "advantage has to come with a number or an example.",
  hint:
    "You have about ten minutes. You need one specific question about how his trading actually " +
    "works, and a next step he can verify.",
  traits: ["does his own maths", "takes nothing on trust", "in a hurry"],
  hiddenNeed:
    "What actually irritates him is not the commission but the second broker he has to keep for " +
    "European and Asian venues: two sets of statements, two margin pools, money in transit for " +
    "two days. He will only say so if the salesperson asks how his current setup works instead " +
    "of pitching straight away.",
  manner: [
    "Speaks briefly, rarely asks questions of his own — answers what he was asked",
    "Considers himself more experienced than the salesperson and tests that on the first reply",
    "No tolerance for generalities: at \"the best terms on the market\" he asks for a number or an example",
    "If the salesperson pushes or promises gains, he gets drier and starts closing the conversation",
  ],
  initialState: { trust: 2, interest: 3, patience: 4 },
} satisfies Persona;
