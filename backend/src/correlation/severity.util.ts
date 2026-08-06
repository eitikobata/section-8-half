// Pure function, deliberately isolated from the service so it's trivial
// to unit test and to explain: the incident's severity is NOT the raw
// severity of any single event — it's derived from the whole window.
//
// Formula: average severityRaw of the window, plus a bonus for every
// event beyond the minimum threshold (more suspicious events firing in
// the same window = the pattern is more deliberate, not just noisy).
// Result is clamped to the same 0-100 scale sensors already use.
export function computeSeverity(
  events: { severityRaw: number }[],
  eventThreshold: number,
): number {
  if (events.length === 0) return 0;

  const avg =
    events.reduce((sum, e) => sum + e.severityRaw, 0) / events.length;
  const countBonus = Math.max(0, events.length - eventThreshold) * 5;

  return Math.min(100, Math.round(avg + countBonus));
}
