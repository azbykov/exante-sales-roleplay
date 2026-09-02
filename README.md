# EXANTE — sales simulator (vertical slice)

Live at **[exante-sales-roleplay.vercel.app](https://exante-sales-roleplay.vercel.app)** — nothing to install and no
key to supply; the client speaks first.

A vertical slice with one registered persona and one scenario: a dialogue to its
resolution and a debrief at the end. The runtime already supports a library of
personas and scenarios without copying prompts or API handlers.

The salesperson talks to an AI client that behaves according to a written
persona and decides for itself how the conversation ends. After the resolution,
a separate pass over the transcript assembles the report: a turning point, one
specific action for next time, and three scores with quotes as evidence.

## The document behind it

The product and architecture write-up is
[exante-sales-simulator.md](exante-sales-simulator.md). Where this README says
*what* the code does, that document says *why*:

- [Vision](exante-sales-simulator.md#vision) — [who it is for](exante-sales-simulator.md#who-it-is-for-and-what-it-solves),
  [the core](exante-sales-simulator.md#the-core) loop, [the report](exante-sales-simulator.md#the-report),
  [life after the tenth session](exante-sales-simulator.md#life-after-the-tenth-session),
  [why anyone would use it voluntarily](exante-sales-simulator.md#why-anyone-would-use-it-voluntarily),
  and [what grows around the core](exante-sales-simulator.md#what-grows-around-the-core).
- [Architecture](exante-sales-simulator.md#architecture) —
  [where the conversation lives](exante-sales-simulator.md#the-session-where-the-conversation-lives),
  [how the avatar works](exante-sales-simulator.md#1-how-the-avatar-works)
  and its [system fields and invariants](exante-sales-simulator.md#system-fields-and-invariants),
  [personas and scenarios as artifacts](exante-sales-simulator.md#2-personas-and-scenarios-as-artifacts),
  [where the score comes from](exante-sales-simulator.md#3-where-the-score-comes-from-and-why-it-can-be-trusted),
  and [how we know it works](exante-sales-simulator.md#4-how-we-know-it-works--and-keeps-working).
- [What I'm not doing and why](exante-sales-simulator.md#what-im-not-doing-and-why) — the cut, in
  [product](exante-sales-simulator.md#product), [engineering of the slice](exante-sales-simulator.md#engineering-of-the-slice)
  and [trust in the score](exante-sales-simulator.md#trust-in-the-score).
- [Questions and assumptions](exante-sales-simulator.md#questions-and-assumptions) — nine questions for
  the client, and the assumption made instead of each answer.

## Running it

```bash
npm install
```

No API key at hand? Go straight to the recorded session — same routes, same
state, same report, no model calls:

```bash
npm run dev:demo
```

Open http://localhost:3000 and press *Play the demo*.

For a live conversation, put one key — either of the two — into `.env.local`
(the file is in `.gitignore`):

```bash
echo 'OPENAI_API_KEY=sk-...' > .env.local
```

With `OPENAI_API_KEY` present, requests go to OpenAI directly. Without it, they
go through the [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) using
`AI_GATEWAY_API_KEY`.

```bash
npm run dev
```

Open http://localhost:3000 — the client speaks first.

## What is inside

```
lib/session.ts     the conversation: open one, play a line, build the debrief; runTurn and runReport underneath
lib/session-store.ts  where a conversation lives while it is played — swap this file for Redis
lib/state.ts       the vocabulary shared with the browser: client state, outcomes, resolution reasons
lib/catalogue.ts   what the browser receives from the API, plus the route and endpoint tables
lib/http.ts        the two helpers every route is built from: parse the body, map the failure
lib/llm.ts         which models are used: avatar and evaluator are set separately
lib/scenario.ts    the Persona, ScenarioArtifact and assembled Scenario types
lib/content/personas       persona files: character and initial state
lib/content/scenarios      exercise files referencing a personaId
lib/content/registry.ts    registration and server-side persona + scenario assembly
lib/content/product-facts.ts  checkable product facts the evaluator verifies claims against
lib/rubric.ts      three dimensions with scale anchors + compliance rules
lib/avatar.ts      avatar prompt assembly and the turn schema
lib/evaluator.ts   the report schema and the evaluator prompt
app/api/scenarios  a safe catalogue for the UI, without the character's hidden fields
app/api/sessions   open a conversation; then GET / DELETE, /turns and /report on its id
app/session.tsx    the browser's side of a session: an id and a view of what the server has
app/page.tsx       /  — persona selection, the only screen that opens a session
app/s/[sessionId]           /s/:sessionId — the conversation
app/s/[sessionId]/debrief   /s/:sessionId/debrief — its report
scripts/eval       scenario runs: npm run eval
```

Personas, scenarios and the rubric are data, not text inside a prompt. To add a
client, create a file in `lib/content/personas/`, a scenario carrying its
`personaId` in `lib/content/scenarios/`, and register both objects in
`lib/content/registry.ts`. The Character and Analyzer prompts, the API and the
UI stay untouched — the reasoning is in
[Personas and scenarios as artifacts](exante-sales-simulator.md#2-personas-and-scenarios-as-artifacts).

## Decisions visible in the code

The long form of this list, with the alternatives that were rejected, is
[Architecture](exante-sales-simulator.md#architecture).

- **The domain has one implementation.** `runTurn` and `runReport` in
  [lib/session.ts](lib/session.ts) are the whole product; the API routes are
  adapters that parse the request and map the failure, and `npm run eval` drives
  the same two functions. A change to the dialogue loop cannot pass the checks
  unnoticed, because there is no second copy of it to change.
- **The prompts cannot reach the browser.** `lib/avatar.ts`, `lib/evaluator.ts`
  and the content registry are marked `server-only`, so an import from a client
  component fails the build rather than shipping the character's instructions
  and the hidden need to the salesperson. What the UI is allowed to see is the
  projection in `listScenarios()`.
- **Requests are validated, and maxTurns is a limit.** Both routes parse the body
  with zod before anything is spent on a model call, and a conversation past
  `maxTurns` is refused. If the model still returns `open` on the closing turn,
  the code lands it as `no_deal` / `max_turns` — the same discipline as
  `clampState`: what the prompt asks for, the code guarantees.
- **The conversation belongs to the server.** A session is opened by
  `POST /api/sessions`; after that the browser holds an id, a line is posted on
  its own, and the debrief request carries no body. The outcome the evaluator is
  told to keep is the one the avatar declared and the store recorded — there is
  no field for a client to send one in, so `deal` cannot be typed into a failed
  conversation. `maxTurns` is checked against the stored transcript for the same
  reason. The store is a map in the process behind a `SessionStore` interface:
  the one file to replace with Redis or Vercel KV, which a serverless deployment
  needs. The reasoning is in
  [The session](exante-sales-simulator.md#the-session-where-the-conversation-lives).
- **Each screen is a URL, and the URL names the conversation.** Selection,
  conversation and debrief are three routes keyed by session id, so a reload
  resumes the exchange where it stopped and a link addresses one specific
  conversation. A session that has expired or been ended says so and offers the
  picker, rather than showing an empty shell.
- **The model is a parameter, not a dependency.** Next.js + AI SDK: the provider
  is chosen by which key is present, the model is a string in
  [lib/llm.ts](lib/llm.ts) or an environment variable. The avatar and the
  evaluator are configured separately: the first needs speed, the second depth.
- **The avatar declares the resolution**, not a button and not a turn counter:
  on every turn the model returns both the reply and the state (`open` / `deal`
  / `no_deal` / `walkout`). The final turn carries a typed `resolutionReason`;
  the schema checks that the reason matches the outcome. At `maxTurns` the
  conversation is landed deliberately.
- **Evaluation is a separate pass.** The avatar does not know the rubric, the
  evaluator takes no part in the conversation. Otherwise the persona starts
  playing to the score.
- **Accuracy about the product is checked against a list of facts**, not against
  the model's memory: [product-facts.ts](lib/content/product-facts.ts) is an
  artifact shared by all scenarios, assembled from public sources. A claim that
  contradicts a fact is an error; a claim that is not in the list is unverified
  and never lowers the score.
- **Every observed skill requires a quote** from the transcript — a score
  without evidence cannot be disputed. If there was no material to score, the
  Analyzer returns `observed: false` and `score: null` rather than inventing an
  average. What the score rests on is argued in
  [Where the score comes from](exante-sales-simulator.md#3-where-the-score-comes-from-and-why-it-can-be-trusted).
- **Compliance is not averaged** with the other dimensions: a promise of returns
  is a separate flag, and good Discovery does not cancel it out.
- **Client state** (trust, interest, patience) is updated by the avatar on every
  turn, and the allowed band (no more than two points per turn) is enforced in
  code rather than merely requested in the prompt. During the conversation it is
  hidden — a visible trust counter turns
  practice into a game with numbers. In the report it becomes a trace: where the
  conversation went down. The same trace is handed to the evaluator as grounds
  for the turning point.
- **Session history** lives in `localStorage` together with `personaId`,
  `scenarioId` and their versions: a trend is compared only within one version
  of a scenario, and it works without a backend or accounts.

## Demo mode

```bash
npm run dev:demo
```

No key needed: instead of model calls, a recorded session is substituted
([lib/content/demo/](lib/content/demo/active-trader-switching.ts)). A "Play the
demo" button appears in the header — a five-line conversation plays itself and
ends with a report. It exists for two things: showing the product to someone
without a key, and recording a video where every run is identical.

The recorded data passes the same schemas as a live model response, and loading
fails if they diverge — the mock cannot quietly go stale. The execution path is
the same one: only the source of the reply is swapped, while the routes, the
client state, the session history and the report work exactly as they do live.

## Checks

```bash
npm run eval
```

Synthetic "salespeople" play the scenario through: an attempt to break the
avatar out of role, a neutral greeting, pressure, promising returns, false
product claims, pitching without questions, doing it properly. Two more probes
run on a single line: a greeting must not move the client's state, and rudeness
cannot improve it. Properties of the conversation are checked rather than exact
text — anything arguable goes to an LLM judge. Statuses are pass / fail / warn /
error, and results are compared with the previous run.

The transcript of a failing probe is saved to `.eval/`. A single probe can be
run on its own:

```bash
npm run eval -- pressure
```

The run makes real API calls and costs money.

What these probes are for, and what a check on a non-deterministic system can
and cannot prove, is
[How we know it works — and keeps working](exante-sales-simulator.md#4-how-we-know-it-works--and-keeps-working).

## Boundaries of the slice

Deliberately absent: an admin UI, authentication, server-side storage, voice,
and the "Assessment" mode for the company. The library framework is there, but
in this slice it holds one persona and one scenario. The reasoning behind each
cut is in
[What I'm not doing and why](exante-sales-simulator.md#what-im-not-doing-and-why),
split into [product](exante-sales-simulator.md#product),
[engineering of the slice](exante-sales-simulator.md#engineering-of-the-slice)
and [trust in the score](exante-sales-simulator.md#trust-in-the-score).

EXANTE product facts are taken from public sources and simplified: a simulator
needs plausibility, not the accuracy of a product catalogue.

## Deployment

Deployed at [exante-sales-roleplay.vercel.app](https://exante-sales-roleplay.vercel.app), running against a live
model rather than the recorded session: every turn is a real model call, so a
reply takes a few seconds.

```bash
vercel
```

No key is needed in the project variables: on Vercel the gateway authorises
requests with the deployment's OIDC token (`VERCEL_OIDC_TOKEN`), which the code
picks up by itself. For local development the token can be pulled with
`vercel env pull`, but it lives for about 12 hours, so a plain
`AI_GATEWAY_API_KEY` is more reliable for repeatable runs.
