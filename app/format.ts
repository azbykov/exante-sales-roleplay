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

export function formatDay(iso: string): string {
  const today = new Date().toISOString().slice(0, 10);
  if (iso === today) return "today";
  const date = new Date(iso);
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}
