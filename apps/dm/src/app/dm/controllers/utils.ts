/**
 * Utility functions for DM controllers
 */

/**
 * Calculate direction from center tile to surrounding tile
 */
export function getDirectionFromCenter(
  centerX: number,
  centerY: number,
  tileX: number,
  tileY: number,
): string {
  const dx = tileX - centerX;
  const dy = tileY - centerY;

  if (dx === 0 && dy === -1) return 'north';
  if (dx === 1 && dy === -1) return 'northeast';
  if (dx === 1 && dy === 0) return 'east';
  if (dx === 1 && dy === 1) return 'southeast';
  if (dx === 0 && dy === 1) return 'south';
  if (dx === -1 && dy === 1) return 'southwest';
  if (dx === -1 && dy === 0) return 'west';
  if (dx === -1 && dy === -1) return 'northwest';

  return 'unknown';
}
