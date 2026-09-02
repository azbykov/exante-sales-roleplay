const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");

export const formatScore = (value: number) => value.toFixed(1);

export function averageScore(scores: (number | null)[]): number | null {
  const observed = scores.filter((score): score is number => score !== null);
  return observed.length ? observed.reduce((a, b) => a + b, 0) / observed.length : null;
}

export function clock(seconds: number): string {
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function plural(n: number, one: string): string {
  return n === 1 ? one : `${one}s`;
}

/** The local calendar day, as YYYY-MM-DD. What history entries are stamped with. */
export function todayISO(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * A stored day, for the trend row. The date is parsed with an explicit time:
 * bare "2026-09-02" is read as UTC midnight, which renders as the day before
 * anywhere west of Greenwich.
 */
export function formatDay(iso: string, now: Date = new Date()): string {
  if (iso === todayISO(now)) return "today";
  const date = new Date(`${iso}T00:00:00`);
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}
