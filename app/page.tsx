"use client";

import { useEffect, useRef, useState } from "react";
import { DIMENSIONS } from "@/lib/rubric";
import {
  STATE_LABELS,
  type ClientState,
  type ConversationState as State,
  type Outcome,
  type ResolutionReason,
  type Turn,
} from "@/lib/state";
import type { Report } from "@/lib/evaluator";

/** What every card in the catalogue shows, playable or not. */
type PersonaCard = {
  id: string;
  name: string;
  headline: string;
  brief: string;
  traits: string[];
};

type ReadyScenario = {
  status: "ready";
  id: string;
  version: string;
  difficulty: 1 | 2 | 3;
  persona: PersonaCard & { version: string; hint: string; initialState: ClientState };
  openingLine: string;
  /** Non-empty only in demo mode: the salesperson's recorded lines. */
  demoLines: string[];
};

/** Announced, with no scenario behind it yet: there is nothing to start. */
type UpcomingScenario = {
  status: "coming_soon";
  id: string;
  difficulty: 1 | 2 | 3;
  persona: PersonaCard;
};

/**
 * The union is what keeps the disabled button honest: everything that starts a
 * conversation takes a ReadyScenario, so an upcoming card cannot be passed to it
 * even by mistake.
 */
type CatalogueEntry = ReadyScenario | UpcomingScenario;

type PastSession = {
  date: string;
  personaId: string;
  personaVersion: string;
  scenarioId: string;
  scenarioVersion: string;
  outcome: State;
  scores: Record<string, number | null>;
  compliance: boolean;
};

const OUTCOME_LABEL: Record<Outcome, string> = {
  deal: "The client agreed to a next step",
  no_deal: "The client declined",
  walkout: "The client cut the conversation short",
};

const DIFFICULTY_LABEL: Record<1 | 2 | 3, string> = {
  1: "Easy",
  2: "Medium",
  3: "Hard",
};

/** The threshold below which the debrief suggests a replay rather than moving on. */
const TARGET_SCORE = 3.5;

const HISTORY_KEY = "exante-sim-history";
const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");

/**
 * A finished conversation, held together so the debrief can be requested — and
 * retried — without touching the dialogue that produced it.
 */
type Resolution = {
  outcome: Outcome;
  resolutionReason: ResolutionReason;
  turns: Turn[];
  trace: ClientState[];
};

function loadHistory(): PastSession[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
  } catch {
    return [];
  }
}

const formatScore = (value: number) => value.toFixed(1);

function averageScore(scores: (number | null)[]): number | null {
  const observed = scores.filter((score): score is number => score !== null);
  return observed.length ? observed.reduce((a, b) => a + b, 0) / observed.length : null;
}

function clock(seconds: number): string {
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function plural(n: number, one: string): string {
  return n === 1 ? one : `${one}s`;
}

function formatDay(iso: string): string {
  const today = new Date().toISOString().slice(0, 10);
  if (iso === today) return "today";
  const date = new Date(iso);
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

/**
 * The client-state trace. During the conversation only the change after a line
 * is visible; the full picture belongs to the debrief, where it shows where the
 * conversation went down.
 */
function TraceChart({ trace }: { trace: ClientState[] }) {
  if (trace.length < 2) return null;

  const keys = Object.keys(STATE_LABELS) as (keyof ClientState)[];
  const x = (i: number) => 4 + (i / (trace.length - 1)) * 192;
  const y = (value: number) => 33 - value * 5;

  return (
    <section className="trace">
      <div className="eyebrow">Client state trace</div>
      <div className="trace-rows">
        {keys.map((key) => {
          const values = trace.map((point) => point[key]);
          const drops = values.flatMap((value, i) => (i > 0 && value < values[i - 1] ? [i] : []));

          return (
            <div className="trace-row" key={key}>
              <div className="label">{STATE_LABELS[key][0].toUpperCase() + STATE_LABELS[key].slice(1)}</div>
              <svg width="200" height="34" viewBox="0 0 200 34" fill="none">
                <line x1="0" y1="33" x2="200" y2="33" stroke="currentColor" strokeOpacity=".14" />
                <polyline
                  points={values.map((value, i) => `${x(i)},${y(value)}`).join(" ")}
                  fill="none"
                  stroke="currentColor"
                  strokeOpacity=".7"
                  strokeWidth="1.25"
                />
                {drops.map((i) => (
                  <circle key={i} cx={x(i)} cy={y(values[i])} r="2.5" fill="var(--accent)" />
                ))}
              </svg>
              <div className="delta">
                {values[0]} → {values[values.length - 1]}
              </div>
            </div>
          );
        })}
      </div>
      <div className="trace-axis" aria-label="Salesperson line numbers">
        {trace.map((_, i) => (
          <span key={i}>{i + 1}</span>
        ))}
      </div>
    </section>
  );
}

/** State changes after a salesperson line: the first turn shows the full position. */
function Chips({ state, previous }: { state: ClientState; previous?: ClientState }) {
  const keys = Object.keys(STATE_LABELS) as (keyof ClientState)[];
  const title = (key: keyof ClientState) =>
    STATE_LABELS[key][0].toUpperCase() + STATE_LABELS[key].slice(1);

  const items = previous
    ? keys
        .filter((key) => state[key] !== previous[key])
        .map((key) => {
          const delta = state[key] - previous[key];
          return `${title(key)} ${delta > 0 ? "+" : "−"}${Math.abs(delta)} · ${state[key]}/5`;
        })
    : keys.map((key) => `${title(key)} · ${state[key]}/5`);

  if (!items.length) return null;
  return (
    <div className="chips">
      {items.map((item) => (
        <span key={item}>{item}</span>
      ))}
    </div>
  );
}

export default function Page() {
  const [scenarios, setScenarios] = useState<CatalogueEntry[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [scenario, setScenario] = useState<ReadyScenario | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [trace, setTrace] = useState<ClientState[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [failed, setFailed] = useState<{ text: string; turns: Turn[]; trace: ClientState[] } | null>(
    null,
  );
  const [reportError, setReportError] = useState<{ message: string; resolution: Resolution } | null>(
    null,
  );
  const [report, setReport] = useState<Report | null>(null);
  const [history, setHistory] = useState<PastSession[]>([]);
  const [seconds, setSeconds] = useState(0);
  const bottom = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setHistory(loadHistory());

    fetch("/api/scenarios")
      .then(async (response) => {
        const data = (await response.json()) as CatalogueEntry[] | { error?: string };
        if (!response.ok || !Array.isArray(data)) {
          throw new Error("error" in data && data.error ? data.error : "Failed to load scenarios");
        }
        if (data.length === 0) throw new Error("No scenarios available");
        setScenarios(data);
        setExpanded(data[0].id);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load scenarios");
      });
  }, []);

  useEffect(() => {
    if (!scenario || report) return;
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [scenario, report]);

  useEffect(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), [turns, report]);

  /**
   * The textarea is disabled while a turn is in flight, and disabling it drops
   * focus. Put it back as soon as the conversation can take another line, so a
   * whole session can be typed without reaching for the mouse.
   */
  useEffect(() => {
    if (!busy && scenario && !report) composer.current?.focus();
  }, [busy, scenario, report]);

  async function post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Request failed");
    return data as T;
  }

  /**
   * A turn takes the state as an explicit argument and returns the new one: the
   * automatic demo run is a loop and cannot rely on a setState that has not applied yet.
   *
   * The debrief is requested after this, never inside its try: a failure of the
   * evaluator is not a failure of the line that was just sent, and rolling the
   * conversation back for it would throw away a completed exchange.
   */
  async function submit(
    target: ReadyScenario,
    text: string,
    base: Turn[],
    baseTrace: ClientState[],
  ) {
    const next = [...base, { role: "user", content: text } as Turn];
    setTurns(next);
    setInput("");
    setBusy(true);
    setError("");
    setFailed(null);
    setReportError(null);

    let turn: {
      reply: string;
      client: ClientState;
      state: State;
      resolutionReason: ResolutionReason | null;
    };

    try {
      turn = await post("/api/turn", { scenarioId: target.id, turns: next, trace: baseTrace });
    } catch (err) {
      setError(err instanceof Error ? err.message : "The line was not sent");
      setFailed({ text, turns: base, trace: baseTrace });
      setTurns(base);
      setBusy(false);
      return null;
    }

    const withReply = [...next, { role: "assistant", content: turn.reply } as Turn];
    const withState = [...baseTrace, turn.client];
    setTurns(withReply);
    setTrace(withState);

    const finished = turn.state !== "open" && turn.resolutionReason !== null;
    if (finished) {
      // busy stays on: the conversation is over and the debrief is being built.
      await requestReport(target, {
        outcome: turn.state as Outcome,
        resolutionReason: turn.resolutionReason as ResolutionReason,
        turns: withReply,
        trace: withState,
      });
    } else {
      setBusy(false);
    }

    return { turns: withReply, trace: withState, finished };
  }

  /** The debrief for a conversation that has already ended: safe to retry as often as needed. */
  async function requestReport(target: ReadyScenario, resolution: Resolution) {
    setBusy(true);
    setReportError(null);

    try {
      const result = await post<Report>("/api/report", {
        scenarioId: target.id,
        turns: resolution.turns,
        outcome: resolution.outcome,
        resolutionReason: resolution.resolutionReason,
        trace: resolution.trace,
      });
      setReport(result);
      remember(target, resolution.outcome, result);
    } catch (err) {
      // The transcript is untouched — only the debrief is missing, and Retry asks for it again.
      setReportError({
        message: err instanceof Error ? err.message : "The debrief could not be built",
        resolution,
      });
    } finally {
      setBusy(false);
    }
  }

  function remember(target: ReadyScenario, outcome: Outcome, result: Report) {
    const entry: PastSession = {
      date: new Date().toISOString().slice(0, 10),
      personaId: target.persona.id,
      personaVersion: target.persona.version,
      scenarioId: target.id,
      scenarioVersion: target.version,
      outcome,
      scores: Object.fromEntries(result.dimensions.map((d) => [d.id, d.score])),
      compliance: result.compliance.violated,
    };
    const updated = [...loadHistory(), entry];
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    setHistory(updated);
  }

  function open(target: ReadyScenario) {
    setScenario(target);
    setTurns([{ role: "assistant", content: target.openingLine }]);
    setTrace([]);
    setReport(null);
    setError("");
    setFailed(null);
    setReportError(null);
    setInput("");
    setSeconds(0);
  }

  function toSelect() {
    setScenario(null);
    setReport(null);
    setError("");
    setFailed(null);
    setReportError(null);
    setInput("");
    setSeconds(0);
  }

  /** The demo run follows the same path as a live conversation: only the source of replies changes. */
  async function playDemo(target: ReadyScenario) {
    open(target);
    let current = {
      turns: [{ role: "assistant", content: target.openingLine } as Turn],
      trace: [] as ClientState[],
    };

    for (const line of target.demoLines) {
      setInput(line);
      await new Promise((resolve) => setTimeout(resolve, 600));
      const result = await submit(target, line, current.turns, current.trace);
      if (!result) return;
      current = { turns: result.turns, trace: result.trace };
      if (result.finished) return;
    }
  }

  const playable = scenarios.filter((entry): entry is ReadyScenario => entry.status === "ready");

  if (!scenarios.length) {
    return (
      <main className="screen">
        <p className={error ? "center error" : "center"}>{error || "Loading scenarios…"}</p>
      </main>
    );
  }

  // --- Debrief ---

  if (report && scenario) {
    const average = averageScore(report.dimensions.map((d) => d.score));
    const rmTurns = turns.filter((t) => t.role === "user").length;
    const minutes = Math.max(1, Math.round(seconds / 60));

    const sessions = history
      .filter((e) => e.scenarioId === scenario.id && e.scenarioVersion === scenario.version)
      .map((e) => ({ date: e.date, average: averageScore(Object.values(e.scores)) }))
      .filter((e): e is { date: string; average: number } => e.average !== null)
      .slice(-4);

    return (
      <main className="screen">
        <article className="debrief">
          <div className="debrief-inner">
            <section className="result">
              <div className="eyebrow">
                {average === null
                  ? "Result"
                  : `Result · ${average >= TARGET_SCORE ? "above" : "below"} the ${formatScore(TARGET_SCORE)} target`}
              </div>
              <div className="result-score">
                <b>{average === null ? "—" : formatScore(average)}</b>
                <span>
                  {average === null
                    ? "no skills observed"
                    : `out of 5 · ${average >= TARGET_SCORE ? "good" : "worth another attempt"}`}
                </span>
              </div>
              <div className="result-outcome">{OUTCOME_LABEL[report.outcome]}</div>
              <div className="result-meta">
                {scenario.persona.name} · {rmTurns} {plural(rmTurns, "line")} ·{" "}
                {minutes} {plural(minutes, "minute")}
              </div>
            </section>

            <section className="pivot">
              <div className="eyebrow">Turning point</div>
              <blockquote>&ldquo;{report.turningPoint.quote}&rdquo;</blockquote>
              <p>
                {report.turningPoint.speaker === "rm" ? "You" : scenario.persona.name.split(" ")[0]} ·{" "}
                {report.turningPoint.why}
              </p>
            </section>

            <TraceChart trace={trace} />

            <section className="next">
              <div className="eyebrow">What to try differently</div>
              <p>{report.recommendation}</p>
            </section>

            <section className="scores">
              <div className="eyebrow">Scores</div>
              {report.dimensions.map((dimension) => {
                const meta = DIMENSIONS.find((d) => d.id === dimension.id);
                return (
                  <div className="dim" key={dimension.id}>
                    <div className="dim-head">
                      <div className="title">{meta?.title ?? dimension.id}</div>
                      <div className="score">
                        {dimension.observed ? `${dimension.score} / 5` : "not observed"}
                      </div>
                    </div>
                    <p>{dimension.comment}</p>
                    {dimension.observed && <q>{dimension.evidence}</q>}
                  </div>
                );
              })}
            </section>

            {report.compliance.violated && (
              <section className="flag">
                <div className="eyebrow">Compliance</div>
                <p>{report.compliance.rule}</p>
                <q>{report.compliance.quote}</q>
              </section>
            )}

            {sessions.length > 1 && (
              <section className="history">
                <div className="eyebrow">Average skill score</div>
                <div className="history-row">
                  {sessions.map((session, i) => (
                    <div key={i}>
                      <span className="when">{formatDay(session.date)}</span>
                      <span className="avg">{formatScore(session.average)}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <div>
              <button className="primary replay" onClick={() => open(scenario)}>
                Replay the scenario
              </button>
            </div>
          </div>
        </article>
        <div ref={bottom} />
      </main>
    );
  }

  // --- Conversation ---

  if (scenario) {
    return (
      <main className="screen">
        <div className="chat">
          <header className="chat-head">
            <div>
              <div className="chat-head-name">{scenario.persona.name}</div>
              <div className="chat-head-meta">{scenario.persona.headline}</div>
            </div>
            <div className="chat-head-side">
              <div className="clock">{clock(seconds)}</div>
              <button className="quiet" onClick={toSelect}>
                End
              </button>
            </div>
          </header>

          <div className="chat-body">
            <div className="thread">
              {turns.map((turn, index) => {
                // State appears only after the client replies: count its ordinal number.
                const clientIndex =
                  turn.role === "assistant"
                    ? turns.slice(0, index).filter((t) => t.role === "assistant").length - 1
                    : -1;
                const state = clientIndex >= 0 ? trace[clientIndex] : undefined;

                return (
                  <div className={`msg ${turn.role === "user" ? "rm" : "client"}`} key={index}>
                    <div className="who">
                      {turn.role === "user" ? "You" : scenario.persona.name.split(" ")[0]}
                    </div>
                    <div className="text">{turn.content}</div>
                    {state && <Chips state={state} previous={trace[clientIndex - 1]} />}
                  </div>
                );
              })}

              {busy && (
                <div className="typing">
                  {trace.length && turns.at(-1)?.role === "assistant"
                    ? "Preparing the debrief…"
                    : `${scenario.persona.name.split(" ")[0]} is replying…`}
                </div>
              )}
            </div>
          </div>

          <div className="composer-wrap">
            <form
              className="composer"
              onSubmit={(event) => {
                event.preventDefault();
                const text = input.trim();
                if (text && !busy) void submit(scenario, text, turns, trace);
              }}
            >
              <textarea
                ref={composer}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    const text = input.trim();
                    if (text && !busy) void submit(scenario, text, turns, trace);
                  }
                }}
                placeholder="Your line"
                rows={1}
                disabled={busy}
              />
              <button className="send" type="submit" disabled={busy || !input.trim()} aria-label="Send">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 19V5" />
                  <path d="m5 12 7-7 7 7" />
                </svg>
              </button>
            </form>

            {error && (
              <div className="notice">
                {error}
                {failed && (
                  <>
                    {" "}
                    <button onClick={() => void submit(scenario, failed.text, failed.turns, failed.trace)}>
                      Retry
                    </button>
                  </>
                )}
              </div>
            )}

            {reportError && (
              <div className="notice">
                The conversation is saved, but the debrief failed: {reportError.message}{" "}
                <button onClick={() => void requestReport(scenario, reportError.resolution)}>
                  Build the debrief
                </button>
              </div>
            )}
          </div>
        </div>
        <div ref={bottom} />
      </main>
    );
  }

  // --- Persona selection ---

  return (
    <main className="screen">
      <div className="picker">
        <header className="picker-head">
          <div>
            <div className="eyebrow">New session</div>
            <h1>Who you are talking to</h1>
          </div>
          {playable[0]?.demoLines.length ? (
            <button className="quiet" onClick={() => void playDemo(playable[0])}>
              Play the demo
            </button>
          ) : null}
        </header>

        <div className="picker-list">
          {scenarios.map((option) => {
            const isOpen = expanded === option.id;
            const soon = option.status === "coming_soon";
            return (
              <div className={soon ? "picker-item soon" : "picker-item"} key={option.id}>
                <button
                  className="picker-toggle"
                  aria-expanded={isOpen}
                  onClick={() => setExpanded(isOpen ? null : option.id)}
                >
                  <span className="picker-name">
                    <b>{option.persona.name}</b>
                    <span>{option.persona.headline}</span>
                  </span>
                  <span className="picker-side">
                    <span className="picker-difficulty">{DIFFICULTY_LABEL[option.difficulty]}</span>
                    <span className="picker-symbol">{isOpen ? "−" : "+"}</span>
                  </span>
                </button>

                {isOpen && (
                  <div className="picker-body">
                    <div className="picker-brief">{option.persona.brief}</div>
                    {option.status === "ready" && (
                      <div className="picker-hint">{option.persona.hint}</div>
                    )}
                    <div className="traits">
                      {option.persona.traits.map((trait) => (
                        <span key={trait}>{trait}</span>
                      ))}
                    </div>
                    {option.status === "ready" ? (
                      <button className="primary" onClick={() => open(option)}>
                        Start the conversation
                      </button>
                    ) : (
                      <button className="primary" disabled aria-disabled="true">
                        Coming soon
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
