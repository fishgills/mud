export function isWaterBiome(biomeName?: string | null): boolean {
  if (!biomeName) {
    return false;
  }

  const normalized = biomeName.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return (
    normalized.includes('ocean') ||
    normalized.includes('lake') ||
    normalized.includes('river') ||
    normalized.includes('water')
  );
}
