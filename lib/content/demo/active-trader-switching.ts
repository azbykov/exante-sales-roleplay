import type { DemoSession } from "../../demo";

/**
 * A recorded session for the demo: the transcript of a real run, brought into
 * the same schemas as a live model response. The schemas are validated at load
 * time (lib/demo.ts), so the mock cannot drift away from the product silently.
 */
export const DEMO_ACTIVE_TRADER: DemoSession = {
  scenarioId: "active-trader-switching",

  rmLines: [
    "Hello, Andreas. Before I offer you anything — tell me how your trading is set up at the " +
      "moment: which venues do you work on and through how many brokers?",
    "I see. So that is two accounts, two sets of statements and margin sitting in two places. " +
      "How much time a month goes into reconciling them and moving money between them?",
    "That is exactly the case EXANTE closes: one multi-currency account with direct access to " +
      "50+ exchanges — the US, Europe and Asia from one place, and unified margin across all asset " +
      "classes, so transfers between pools simply do not exist. Our commission is higher than a " +
      "retail broker's — that is the honest part, and I will give you no guarantees on results. " +
      "I suggest testing it on your own instruments: I will give you a week of demo access and " +
      "calculate your real saving on 40 trades. Would you like to look?",
    "A fair question. EXANTE operates under licences in the EU and the UK, and client funds are " +
      "held separately from the company's own accounts. So you do not have to take my word for " +
      "it — I will send the licence numbers and registry links along with the access, and you can " +
      "check them yourself. Shall I open a week of demo on your email?",
    "Reasonable. I will not quote figures from memory — I will send you the tariff extract for " +
      "exactly your two categories: US options and European equities with ETFs, and alongside it " +
      "I will price your 40 trades a month including the second broker. Sending it today together " +
      "with the access.",
  ],

  avatarTurns: [
    {
      reply:
        "Mostly the US: equities and options, around 40 trades a month. Right now that is one large " +
        "retail broker, but for Europe and Asia I keep a second one — otherwise I do not cover the " +
        "venues I need.",
      client: { trust: 2, interest: 3, patience: 4 },
      state: "open",
      resolutionReason: null,
    },
    {
      reply:
        "Yes, that is exactly what irritates me: two statements, two margin pools, and money moves " +
        "between them slowly. Reconciliation is a couple of hours a month, but the transfers drive " +
        "me mad — sometimes one or two business days, and in that window my hands are tied.",
      client: { trust: 3, interest: 4, patience: 4 },
      state: "open",
      resolutionReason: null,
    },
    {
      reply:
        "It is sensible of you not to promise that I will earn more. I can look at a week of demo, " +
        "but first, briefly: who regulates you and where are the client's money and assets actually held?",
      client: { trust: 3, interest: 4, patience: 4 },
      state: "open",
      resolutionReason: null,
    },
    {
      reply:
        "All right, send the registry links, that matters. Let's do the demo, but I need to see the " +
        "commission figures for US options and European equities — at least the order of magnitude, " +
        "so I don't waste a week. Same email you wrote from.",
      client: { trust: 3, interest: 4, patience: 3 },
      state: "open",
      resolutionReason: null,
    },
    {
      reply:
        "That works for me: price it on my trades, not in a vacuum. Send the extract together with " +
        "the access and the registry links — I will look during the week and come back with questions.",
      client: { trust: 3, interest: 4, patience: 4 },
      state: "deal",
      resolutionReason: "need_matched",
    },
  ],

  report: {
    outcome: "deal",
    resolutionReason: "need_matched",
    turningPoint: {
      quote:
        "Our commission is higher than a retail broker's — that is the honest part, and I will give " +
        "you no guarantees on results. I suggest testing it on your own instruments: I will give you " +
        "a week of demo access and calculate your real saving on 40 trades. Would you like to look?",
      speaker: "rm",
      why:
        "After naming the downside directly and offering a test on the client's own data, the " +
        "conversation moved to the terms of a next step for the first time.",
    },
    recommendation:
      "Before offering the demo, ask: \"What do you pay per contract on US options today, and what " +
      "does the second broker cost you for Europe?\" — then the saving is calculated from his " +
      "figures rather than yours.",
    dimensions: [
      {
        id: "discovery",
        observed: true,
        score: 5,
        evidence:
          "Before I offer you anything — tell me how your trading is set up at the moment: " +
          "which venues do you work on and through how many brokers?",
        comment:
          "Started with diagnosis and drove it to specifics: venues, number of brokers, volume and " +
          "the operational pain of transfers.",
      },
      {
        id: "objection",
        observed: true,
        score: 5,
        evidence:
          "So you do not have to take my word for it — I will send the licence numbers and registry " +
          "links along with the access, and you can check them yourself.",
        comment: "Closed the reliability objection with checkable proof rather than reassurance.",
      },
      {
        id: "accuracy",
        observed: true,
        score: 5,
        evidence:
          "Our commission is higher than a retail broker's — that is the honest part, and I will " +
          "give you no guarantees on results.",
        comment: "Named the limitation outright, promised no gain, relied on properties of the product.",
      },
    ],
    compliance: { violated: false, quote: "", rule: "" },
  },
};
