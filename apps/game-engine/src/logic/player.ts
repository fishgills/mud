import prisma from '../prisma';

export async function getPlayerLocationInfo(playerId: number) {
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) return { error: 'Player not found', status: 404 };
  const tile = await prisma.worldTile.findUnique({
    where: { x_y_z: { x: player.x, y: player.y, z: player.z } },
    include: {
      biome: true,
      players: {
        where: { id: { not: player.id } },
        select: { id: true, name: true },
      },
    },
  });
  if (!tile) return { error: 'Location not found', status: 404 };
  const directions: Record<string, [number, number, number]> = {
    n: [0, 1, 0],
    s: [0, -1, 0],
    e: [1, 0, 0],
    w: [-1, 0, 0],
    up: [0, 0, 1],
    down: [0, 0, -1],
  };
  const possibleDirections: string[] = [];
  for (const [dir, [dx, dy, dz]] of Object.entries(directions)) {
    const exists = await prisma.worldTile.findUnique({
      where: { x_y_z: { x: player.x + dx, y: player.y + dy, z: player.z + dz } },
      select: { id: true },
    });
    if (exists) possibleDirections.push(dir);
  }
  return {
    x: tile.x,
    y: tile.y,
    z: tile.z,
    description: tile.description,
    biome: tile.biome.name,
    biomeDescription: tile.biome.description,
    biomeMix: tile.biomeMix ?? { [tile.biome.name]: 1 },
    otherPlayers: tile.players,
    possibleDirections,
  };
}
