import { STATE_LABELS, type ClientState } from "@/lib/state";

/**
 * The client-state trace. During the conversation only the change after a line
 * is visible; the full picture belongs to the debrief, where it shows where the
 * conversation went down.
 */
export function TraceChart({ trace }: { trace: ClientState[] }) {
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
