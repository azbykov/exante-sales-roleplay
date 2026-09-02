"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  api,
  type CatalogueEntry,
  type PublicSession,
  type ReadyScenario,
} from "@/lib/catalogue";
import type { ConversationState } from "@/lib/state";
import type { Report } from "@/lib/evaluator";

/**
 * The browser's side of a session.
 *
 * It holds an id and a view of what the server has. The transcript, the state
 * trace and the outcome live on the server, so a reload keeps the conversation
 * and a link addresses one specific conversation. Nothing here is the source of
 * anything: every action is a request, and the answer replaces the view.
 *
 * This provider sits in the root layout, which the App Router keeps mounted, so
 * moving between the conversation and its debrief costs no refetch.
 */

export type PastSession = {
  date: string;
  personaId: string;
  personaVersion: string;
  scenarioId: string;
  scenarioVersion: string;
  outcome: ConversationState;
  scores: Record<string, number | null>;
  compliance: boolean;
};

type SendFailure = { text: string };

type Session = {
  scenarios: CatalogueEntry[];
  catalogueError: string;
  catalogueLoaded: boolean;

  session: PublicSession | null;
  loading: boolean;
  /** Set when the session behind the URL is gone: expired, ended, or never existed. */
  missing: string;
  history: PastSession[];

  busy: boolean;
  error: string;
  failed: SendFailure | null;
  reportError: string;

  /** The composer text. Owned here because the demo run types into it. */
  input: string;
  setInput: (text: string) => void;
  /** Seconds elapsed, from the server's clock rather than the browser's. */
  elapsed: number;

  begin: (scenario: ReadyScenario, demo?: boolean) => Promise<string | null>;
  ensure: (sessionId: string) => void;
  send: (text: string) => void;
  retrySend: () => void;
  requestReport: () => void;
  leave: () => void;
};

const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside <SessionProvider>");
  return value;
}

const HISTORY_KEY = "exante-sim-history";

function loadHistory(): PastSession[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
  } catch {
    return [];
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (res.status === 204) return undefined as T;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data as T;
}

const post = <T,>(path: string, body?: unknown) =>
  request<T>(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [scenarios, setScenarios] = useState<CatalogueEntry[]>([]);
  const [catalogueError, setCatalogueError] = useState("");
  const [catalogueLoaded, setCatalogueLoaded] = useState(false);

  const [session, setSession] = useState<PublicSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [missing, setMissing] = useState("");
  const [history, setHistory] = useState<PastSession[]>([]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [failed, setFailed] = useState<SendFailure | null>(null);
  const [reportError, setReportError] = useState("");
  const [input, setInput] = useState("");
  const [now, setNow] = useState(() => Date.now());

  /** Which id a fetch is already in flight for, so a re-render does not refetch. */
  const fetching = useRef<string | null>(null);

  useEffect(() => {
    setHistory(loadHistory());

    request<CatalogueEntry[]>(api.scenarios)
      .then((data) => {
        if (!Array.isArray(data)) throw new Error("Failed to load scenarios");
        if (data.length === 0) throw new Error("No scenarios available");
        setScenarios(data);
      })
      .catch((err: unknown) => {
        setCatalogueError(err instanceof Error ? err.message : "Failed to load scenarios");
      })
      .finally(() => setCatalogueLoaded(true));
  }, []);

  useEffect(() => {
    if (session?.phase !== "talking") return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [session?.phase]);

  function remember(view: PublicSession, report: Report) {
    const entry: PastSession = {
      date: new Date().toISOString().slice(0, 10),
      personaId: view.scenario.persona.id,
      personaVersion: view.scenario.persona.version,
      scenarioId: view.scenario.id,
      scenarioVersion: view.scenario.version,
      outcome: report.outcome,
      scores: Object.fromEntries(report.dimensions.map((d) => [d.id, d.score])),
      compliance: report.compliance.violated,
    };
    const updated = [...loadHistory(), entry];
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    setHistory(updated);
  }

  /** The debrief for a conversation the server saw end. Safe to ask for again. */
  async function askForReport(id: string) {
    setBusy(true);
    setReportError("");
    try {
      const view = await post<PublicSession>(api.report(id));
      setSession(view);
      if (view.report) remember(view, view.report);
    } catch (err) {
      // The transcript is on the server and untouched — only the debrief is missing.
      setReportError(err instanceof Error ? err.message : "The debrief could not be built");
    } finally {
      setBusy(false);
    }
  }

  async function sendLine(id: string, text: string) {
    setInput("");
    setBusy(true);
    setError("");
    setFailed(null);
    setReportError("");

    let view: PublicSession;
    try {
      view = await post<PublicSession>(api.turns(id), { text });
    } catch (err) {
      setError(err instanceof Error ? err.message : "The line was not sent");
      setFailed({ text });
      setBusy(false);
      return null;
    }

    setSession(view);
    if (view.phase === "resolved") {
      // busy stays on: the conversation is over and the debrief is being built.
      await askForReport(id);
    } else {
      setBusy(false);
    }
    return view;
  }

  /** The demo run follows the same path as a live conversation: only the source of replies changes. */
  async function playDemo(id: string, lines: string[]) {
    for (const line of lines) {
      setInput(line);
      await new Promise((resolve) => setTimeout(resolve, 4_000));
      const view = await sendLine(id, line);
      if (!view || view.phase !== "talking") return;
    }
  }

  async function begin(scenario: ReadyScenario, demo = false) {
    setBusy(true);
    setError("");
    setFailed(null);
    setReportError("");
    setMissing("");
    setInput("");

    try {
      const view = await post<PublicSession>(api.sessions, { scenarioId: scenario.id });
      setSession(view);
      setNow(Date.now());
      if (demo) void playDemo(view.id, scenario.demoLines);
      return view.id;
    } catch (err) {
      setError(err instanceof Error ? err.message : "The session could not be opened");
      return null;
    } finally {
      setBusy(false);
    }
  }

  /** Load the conversation named by the URL, unless it is already the one in hand. */
  function ensure(sessionId: string) {
    if (session?.id === sessionId || fetching.current === sessionId || missing === sessionId) return;

    fetching.current = sessionId;
    setLoading(true);
    request<PublicSession>(api.session(sessionId))
      .then((view) => {
        setSession(view);
        setNow(Date.now());
        setMissing("");
      })
      .catch(() => setMissing(sessionId))
      .finally(() => {
        if (fetching.current === sessionId) fetching.current = null;
        setLoading(false);
      });
  }

  function leave() {
    const id = session?.id;
    setSession(null);
    setMissing("");
    setError("");
    setFailed(null);
    setReportError("");
    setInput("");
    // The conversation is over for the reader; the server need not keep it.
    if (id) void request(api.session(id), { method: "DELETE" }).catch(() => undefined);
  }

  const elapsed = session
    ? Math.max(0, Math.floor(((session.endedAt ?? now) - session.startedAt) / 1000))
    : 0;

  const value: Session = {
    scenarios,
    catalogueError,
    catalogueLoaded,
    session,
    loading,
    missing,
    history,
    busy,
    error,
    failed,
    reportError,
    input,
    setInput,
    elapsed,
    begin,
    ensure,
    send: (text) => {
      if (session && !busy) void sendLine(session.id, text);
    },
    retrySend: () => {
      if (session && failed) void sendLine(session.id, failed.text);
    },
    requestReport: () => {
      if (session && !busy) void askForReport(session.id);
    },
    leave,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
