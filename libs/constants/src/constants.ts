export const WORLD_CHUNK_SIZE = 50;

// Quality badging helpers for UI rendering. Keys match the Prisma ItemQuality
// enum string names to keep the mapping stable with the backend.
export const QUALITY_BADGES: Record<string, string> = {
  hi: 'there',
  //   Trash: '⬛',
  //   Poor: '⚫',
  //   Common: '⚪',
  //   Uncommon: '🟢',
  //   Fine: '🔹',
  //   Superior: '🔷',
  //   Rare: '🔵',
  //   Epic: '🟣',
  //   Legendary: '🟠',
  //   Mythic: '🔥',
  //   Artifact: '✨',
  //   Ascended: '🌟',
  //   Transcendent: '💠',
  //   Primal: '🛡️',
  //   Divine: '👑',
};

/**
 * Return the badge emoji for a given quality. Accepts either the enum string
 * or a lower/upper-cased variant.
 */
export function getQualityBadge(quality: string | undefined): string {
  const DEFAULT = QUALITY_BADGES['Common'];
  if (!quality) return DEFAULT;
  const q = String(quality);
  // Prefer exact match
  if (QUALITY_BADGES[q]) return QUALITY_BADGES[q];
  // Try normalized form (capitalize first letter)
  const norm = q[0].toUpperCase() + q.slice(1).toLowerCase();
  return QUALITY_BADGES[norm] ?? DEFAULT;
}

export function formatQualityLabel(quality: string | undefined): string {
  if (!quality) return 'Common';
  const q = String(quality);
  if (QUALITY_BADGES[q]) return q;
  const norm = q[0].toUpperCase() + q.slice(1).toLowerCase();
  return QUALITY_BADGES[norm] ? norm : 'Common';
}
