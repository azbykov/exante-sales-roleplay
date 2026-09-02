/**
 * Product facts are an artifact of the same class as the rubric: data shared by
 * every scenario rather than text inside a prompt. The evaluator checks the RM's
 * claims against this list, so the accuracy dimension rests on something
 * checkable instead of the model's memory.
 *
 * One rule: what is not here is unverified, not false. The list is deliberately
 * incomplete, and stepping outside it must never cost the salesperson a point.
 *
 * In production this place is taken by a maintained knowledge base with
 * retrieval over official sources; for the evaluator the interface does not
 * change — it still receives a list of facts.
 *
 * Source: public pages on exante.eu, verified 2026-09-02.
 */

export const PRODUCT_FACTS_VERSION = "2026-09-02";

export const PRODUCT_FACTS: string[] = [
  "One multi-currency account gives access to more than 2,000,000 instruments across 50+ markets.",
  "Asset classes: equities, ETFs, bonds, futures, options, metals, currencies.",
  "Equities and ETFs: more than 70,000 securities, commissions from $0.02 per trade.",
  "Futures: more than 3,000 contracts on major venues (CME, NYMEX, EUREX), commissions from $1.50.",
  "Options: more than 25,000 tickers, commissions from $1.50.",
  "Bonds: 20,000 available directly, up to 300,000 on request; commissions from 9 basis points.",
  "Currencies: more than 50 pairs, spreads from 0.3.",
  "Metals: commissions from 0.005%.",
  "There is no custody fee on equities and ETFs. There is an inactivity fee.",
  "Commissions and terms vary by instrument, market and client; trading is not commission-free.",
  "The proprietary platform is synchronised across desktop, web and mobile.",
  "FIX and HTTP APIs are available; API access carries no minimum commitment.",
  "Margin and cross-margin trading are supported across asset classes.",
  "Each client is assigned a relationship manager; there is a trade desk and support for OTC trades, including bonds.",
  "The brand covers LHCM LTD (regulated by the FCA, UK), XHK Limited (SFC, Hong Kong) and EXT LTD (CySEC, Cyprus).",
  "Client assets are segregated in line with MiFID II and held with major custodians in Europe and Asia.",
  "The company was founded in 2011 and serves clients in more than 100 countries.",
];
