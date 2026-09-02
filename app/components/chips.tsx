import { STATE_LABELS, type ClientState } from "@/lib/state";

/** State changes after a salesperson line: the first turn shows the full position. */
export function Chips({ state, previous }: { state: ClientState; previous?: ClientState }) {
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
