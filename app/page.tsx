"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { routes, type ReadyScenario } from "@/lib/catalogue";
import { useSession } from "./session";

const DIFFICULTY_LABEL: Record<1 | 2 | 3, string> = {
  1: "Easy",
  2: "Medium",
  3: "Hard",
};

/** Persona selection. The only screen that can start a session. */
export default function PickerPage() {
  const { scenarios, catalogueError, catalogueLoaded, busy, error, begin } = useSession();
  const [expanded, setExpanded] = useState<string | null>(null);
  const router = useRouter();

  if (!scenarios.length) {
    return (
      <main className="screen">
        <p className={catalogueError ? "center error" : "center"}>
          {catalogueError || (catalogueLoaded ? "No scenarios available" : "Loading scenarios…")}
        </p>
      </main>
    );
  }

  const openCard = expanded ?? scenarios[0].id;
  const playable = scenarios.filter((entry): entry is ReadyScenario => entry.status === "ready");
  const demo = playable.find((entry) => entry.demoLines.length > 0);

  // The server opens the session and names it; only then does the URL change, so
  // the conversation screen finds the session already in hand.
  async function openSession(target: ReadyScenario, demo: boolean) {
    const id = await begin(target, demo);
    if (id) router.push(routes.chat(id));
  }

  return (
    <main className="screen">
      <div className="picker">
        <header className="picker-head">
          <div>
            <div className="eyebrow">New session</div>
            <h1>Who you are talking to</h1>
          </div>
          {demo && (
            <button className="quiet" disabled={busy} onClick={() => void openSession(demo, true)}>
              Play the demo
            </button>
          )}
        </header>

        <div className="picker-list">
          {scenarios.map((option) => {
            const isOpen = openCard === option.id;
            const soon = option.status === "coming_soon";
            return (
              <div className={soon ? "picker-item soon" : "picker-item"} key={option.id}>
                <button
                  className="picker-toggle"
                  aria-expanded={isOpen}
                  onClick={() => setExpanded(isOpen ? "" : option.id)}
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
                      <button
                        className="primary"
                        disabled={busy}
                        onClick={() => void openSession(option, false)}
                      >
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

        {error && <div className="picker-notice notice">{error}</div>}
      </div>
    </main>
  );
}
