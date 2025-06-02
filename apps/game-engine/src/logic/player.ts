import prisma from '../prisma';

export async function getPlayerLocationInfo(playerId: number) {
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) return { error: 'Player not found', status: 404 };
  const tile = await prisma.worldTile.findUnique({
    where: { x_y: { x: player.x, y: player.y } },
    include: { biome: true },
  });
  if (!tile || !tile.biome) return { error: 'Location not found', status: 404 };
  const directions: Record<string, [number, number]> = {
    n: [0, 1],
    s: [0, -1],
    e: [1, 0],
    w: [-1, 0],
  };
  const possibleDirections: string[] = [];
  for (const [dir, [dx, dy]] of Object.entries(directions)) {
    const exists = await prisma.worldTile.findUnique({
      where: { x_y: { x: player.x + dx, y: player.y + dy } },
      select: { id: true },
    });
    if (exists) possibleDirections.push(dir);
  }
  return {
    x: tile.x,
    y: tile.y,
    description: tile.description,
    biome: tile.biome.name,
    biomeDescription: tile.biome.description,
    biomeMix: tile.biomeMix ?? { [tile.biome.name]: 1 },
    possibleDirections,
  };
}
