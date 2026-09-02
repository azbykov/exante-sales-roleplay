"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { routes } from "@/lib/catalogue";
import { Chips } from "@/app/components/chips";
import { clock } from "@/app/format";
import { traceIndexOf } from "@/app/thread";
import { useSession } from "@/app/session";

/** The conversation. Its URL names the session, so a reload resumes it. */
export default function ChatPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const store = useSession();
  const { session, loading, missing, busy, error, failed, reportError, input } = store;

  const bottom = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);

  const mine = session?.id === sessionId;

  // The URL is the address of a conversation on the server: ask for it, and let
  // the answer decide what this screen shows.
  // `store` is deliberately not a dependency: its identity changes every render,
  // while the decision only changes when the session behind the URL does.
  useEffect(() => {
    store.ensure(sessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, session?.id, missing]);

  useEffect(() => {
    if (mine && session?.phase === "debrief") router.replace(routes.debrief(sessionId));
  }, [mine, session?.phase, sessionId, router]);

  /**
   * A conversation that ended but has no debrief yet: ask for one. This is the
   * path after a reload, when the request that would have chained into it is gone.
   */
  useEffect(() => {
    if (mine && session?.phase === "resolved" && !busy && !reportError) store.requestReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine, session?.phase, busy, reportError]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.turns.length]);

  /**
   * The textarea is disabled while a turn is in flight, and disabling it drops
   * focus. Put it back as soon as the conversation can take another line, so a
   * whole session can be typed without reaching for the mouse.
   */
  useEffect(() => {
    if (!busy) composer.current?.focus();
    // `mine` is in here so the composer is focused once a reloaded session arrives,
    // not only when a turn finishes.
  }, [busy, mine]);

  useLayoutEffect(() => {
    const textarea = composer.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [input]);

  if (missing === sessionId) {
    return (
      <main className="screen">
        <div className="center gone">
          <p>This conversation is no longer open.</p>
          <button className="primary" onClick={() => router.replace(routes.picker)}>
            Choose a client
          </button>
        </div>
      </main>
    );
  }

  if (!mine || !session) {
    return (
      <main className="screen">{loading && <p className="center">Opening the conversation…</p>}</main>
    );
  }

  const { scenario, turns, trace } = session;
  const firstName = scenario.persona.name.split(" ")[0];

  function submit() {
    const text = input.trim();
    if (text && !busy) store.send(text);
  }

  return (
    <main className="screen">
      <div className="chat">
        <header className="chat-head">
          <div>
            <div className="chat-head-name">{scenario.persona.name}</div>
            <div className="chat-head-meta">{scenario.persona.headline}</div>
          </div>
          <div className="chat-head-side">
            <div className="clock">{clock(store.elapsed)}</div>
            <button
              className="quiet"
              onClick={() => {
                store.leave();
                router.push(routes.picker);
              }}
            >
              End
            </button>
          </div>
        </header>

        <div className="chat-body">
          <div className="thread">
            {turns.map((turn, index) => {
              const clientIndex = traceIndexOf(turns, index);
              const state = clientIndex >= 0 ? trace[clientIndex] : undefined;

              return (
                <div className={`msg ${turn.role === "user" ? "rm" : "client"}`} key={index}>
                  <div className="who">{turn.role === "user" ? "You" : firstName}</div>
                  <div className="text">{turn.content}</div>
                  {state && <Chips state={state} previous={trace[clientIndex - 1]} />}
                </div>
              );
            })}

            {busy && (
              <div className="typing">
                {session.phase === "talking"
                  ? `${firstName} is replying…`
                  : "Preparing the debrief…"}
              </div>
            )}
          </div>
        </div>

        <div className="composer-wrap">
          <form
            className="composer"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <textarea
              ref={composer}
              value={input}
              onChange={(event) => store.setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submit();
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
                  <button onClick={store.retrySend}>Retry</button>
                </>
              )}
            </div>
          )}

          {reportError && (
            <div className="notice">
              The conversation is saved, but the debrief failed: {reportError}{" "}
              <button onClick={store.requestReport}>Build the debrief</button>
            </div>
          )}
        </div>
      </div>
      <div ref={bottom} />
    </main>
  );
}
