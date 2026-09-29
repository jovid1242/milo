const UNITS: Record<string, number> = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

/** "15m" → 900000. `null` when it is not a whole number followed by ms, s, m, h or d. */
export function parseDuration(value: string): number | null {
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(value.trim());
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = UNITS[match[2] ?? ''];
  return unit === undefined || amount <= 0 ? null : amount * unit;
}
