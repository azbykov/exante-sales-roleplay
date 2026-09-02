"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { DIMENSIONS } from "@/lib/rubric";
import type { Outcome } from "@/lib/state";
import { routes, type ReadyScenario } from "@/lib/catalogue";
import { TraceChart } from "@/app/components/trace-chart";
import { averageScore, formatDay, formatScore, plural } from "@/app/format";
import { useSession } from "@/app/session";

const OUTCOME_LABEL: Record<Outcome, string> = {
  deal: "The client agreed to a next step",
  no_deal: "The client declined",
  walkout: "The client cut the conversation short",
};

/** The threshold below which the debrief suggests a replay rather than moving on. */
const TARGET_SCORE = 3.5;

/** The debrief for one conversation, addressed by the same session id. */
export default function DebriefPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const store = useSession();
  const { session, loading, missing, history, begin } = store;

  const mine = session?.id === sessionId;

  useEffect(() => {
    store.ensure(sessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, session?.id, missing]);

  // A session that has not finished belongs on the conversation screen.
  useEffect(() => {
    if (mine && session && session.phase !== "debrief") router.replace(routes.chat(sessionId));
  }, [mine, session, sessionId, router]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  async function replay(scenario: ReadyScenario) {
    const id = await begin(scenario);
    if (id) router.replace(routes.chat(id));
  }

  if (missing === sessionId) {
    return (
      <main className="screen">
        <div className="center gone">
          <p>This debrief is no longer available.</p>
          <button className="primary" onClick={() => router.replace(routes.picker)}>
            Choose a client
          </button>
        </div>
      </main>
    );
  }

  if (!mine || !session?.report) {
    return (
      <main className="screen">{loading && <p className="center">Opening the debrief…</p>}</main>
    );
  }

  const { scenario, report, trace, rmTurns } = session;
  const average = averageScore(report.dimensions.map((d) => d.score));
  const seconds = Math.max(0, Math.floor(((session.endedAt ?? Date.now()) - session.startedAt) / 1000));
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
                {sessions.map((entry, i) => (
                  <div key={i}>
                    <span className="when">{formatDay(entry.date)}</span>
                    <span className="avg">{formatScore(entry.average)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div>
            <button className="primary replay" onClick={() => void replay(scenario)}>
              Replay the scenario
            </button>
          </div>
        </div>
      </article>
    </main>
  );
}
