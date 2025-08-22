export interface LocationData {
  location: {
    x: number;
    y: number;
    biomeName: string;
    description?: string | null;
  };
  surroundingTiles?: Array<{
    direction: string;
    biomeName: string;
    description?: string | null;
  }>;
  monsters?: Array<{
    id: string;
    name: string;
    hp?: number;
    isAlive?: boolean;
  }>;
  playerInfo?: string | null;
  description?: string | null;
}

export const formatLocationMessage = (
  data: LocationData,
  moveDirection?: string,
): string => {
  let msg = '';

  if (moveDirection) {
    msg += `You moved ${moveDirection}.\n`;
  }

  msg += `You are now at (${data.location.x}, ${data.location.y}) in a ${data.location.biomeName} biome.\n`;

  // Use the main description from the data if available, otherwise fall back to location description
  const description = data.description || data.location.description;
  if (description) {
    msg += `${description}\n`;
  }

  if (data.surroundingTiles && data.surroundingTiles.length) {
    msg += 'Nearby tiles:\n';
    for (const tile of data.surroundingTiles) {
      msg += `- ${tile.direction}: ${tile.biomeName} (${tile.description || 'no description'})\n`;
    }
  }

  if (data.monsters && data.monsters.length) {
    msg += `Monsters nearby: ${data.monsters.map((m) => m.name).join(', ')}\n`;
  }

  if (data.playerInfo) {
    msg += data.playerInfo + '\n';
  }

  return msg;
};
