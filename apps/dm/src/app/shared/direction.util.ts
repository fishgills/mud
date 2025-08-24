// Reusable compass direction helper used across resolvers/services
export function calculateDirection(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): string {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const normalizedAngle = (angle + 360) % 360;
  if (normalizedAngle >= 337.5 || normalizedAngle < 22.5) return 'east';
  if (normalizedAngle >= 22.5 && normalizedAngle < 67.5) return 'northeast';
  if (normalizedAngle >= 67.5 && normalizedAngle < 112.5) return 'north';
  if (normalizedAngle >= 112.5 && normalizedAngle < 157.5) return 'northwest';
  if (normalizedAngle >= 157.5 && normalizedAngle < 202.5) return 'west';
  if (normalizedAngle >= 202.5 && normalizedAngle < 247.5) return 'southwest';
  if (normalizedAngle >= 247.5 && normalizedAngle < 292.5) return 'south';
  return 'southeast';
}
