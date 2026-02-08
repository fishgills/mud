export const displayValue = (value: unknown): string => {
  return value === undefined || value === null ? '—' : String(value);
};

export const effectiveStat = (
  value: number | null | undefined,
): number | null => {
  if (value == null) return null;
  return Math.sqrt(Math.max(0, value));
};
