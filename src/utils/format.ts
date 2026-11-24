/** 950 -> "950", 1234 -> "1.2K", 2_500_000 -> "2.5M". */
export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, '')}K`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
}

/** "24 Nov 2026" from an ISO date, or `null` when there is none. */
export function formatDate(iso: string | undefined | null): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "2026" from an ISO date, or `null`. */
export function yearOf(iso: string | undefined | null): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : String(new Date(ms).getFullYear());
}

/** Total length of a list of seconds as "45 min" or "1 hr 5 min". */
export function formatTotalLength(totalSec: number): string {
  const minutes = Math.max(1, Math.round(totalSec / 60));
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}
