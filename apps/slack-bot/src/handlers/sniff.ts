import { dmSdk } from '../gql-client';
import { HandlerContext } from './types';
import { registerHandler } from './handlerRegistry';
import { getUserFriendlyErrorMessage } from './errorUtils';
import { COMMANDS } from '../commands';
import { toClientId } from '../utils/clientId';

const CARDINAL_DIRECTIONS = [
  { dx: 0, dy: 1 }, // north
  { dx: 1, dy: 0 }, // east
  { dx: 0, dy: -1 }, // south
  { dx: -1, dy: 0 }, // west
];

type QueueEntry = {
  x: number;
  y: number;
  distance: number;
};

type LocationEntitiesResponse = Awaited<
  ReturnType<typeof dmSdk.GetLocationEntities>
>;

type MonstersAtLocation = LocationEntitiesResponse['getMonstersAtLocation'];

const MIN_SNIFF_RANGE = 1;

function sanitizeAbilityScore(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.floor(value));
}

function computeSniffRange(abilityScore: number): number {
  return Math.max(MIN_SNIFF_RANGE, Math.floor(abilityScore / 2));
}

function formatAbilitySummary(
  abilityScore: number,
  sniffRange: number,
): string {
  return `Ability ${abilityScore} → sniff range ${sniffRange} tile${
    sniffRange === 1 ? '' : 's'
  }.`;
}

function formatDirection(dx: number, dy: number): string {
  if (dx === 0 && dy === 0) {
    return 'here';
  }

  const parts: string[] = [];
  if (dy > 0) {
    parts.push('north');
  } else if (dy < 0) {
    parts.push('south');
  }

  if (dx > 0) {
    parts.push('east');
  } else if (dx < 0) {
    parts.push('west');
  }

  return parts.join('-');
}

export const sniffHandlerHelp = `Sniff out the nearest monster with "${COMMANDS.SNIFF}". The scent range scales with your ability stat.`;

export const sniffHandler = async ({ userId, say }: HandlerContext) => {
  const missingCharacterMessage = `You don't have a character yet! Use "${COMMANDS.NEW} Name" to create one.`;

  try {
    const playerRes = await dmSdk.GetPlayerWithLocation({
      slackId: toClientId(userId),
    });

    if (!playerRes.getPlayer.success || !playerRes.getPlayer.data) {
      await say({
        text: playerRes.getPlayer.message ?? missingCharacterMessage,
      });
      return;
    }

    const player = playerRes.getPlayer.data;
    const rawAbility = (player as { ability?: number | null }).ability;
    // Fallback to agility while an explicit ability score is unavailable from the API.
    const abilityScore = sanitizeAbilityScore(
      rawAbility !== undefined && rawAbility !== null
        ? rawAbility
        : player.agility,
    );
    const sniffRange = computeSniffRange(abilityScore);
    const origin = { x: player.x, y: player.y };

    const queue: QueueEntry[] = [{ x: origin.x, y: origin.y, distance: 0 }];
    const visited = new Set<string>([`${origin.x},${origin.y}`]);

    let found:
      | {
          monsters: MonstersAtLocation;
          location: QueueEntry;
        }
      | undefined;

    while (queue.length) {
      const current = queue.shift()!;
      const res = await dmSdk.GetLocationEntities({
        x: current.x,
        y: current.y,
      });

      const monsters = res.getMonstersAtLocation.filter(
        (monster) => monster.isAlive !== false,
      );

      if (monsters.length > 0) {
        found = { monsters, location: current };
        break;
      }

      if (current.distance >= sniffRange) {
        continue;
      }

      for (const direction of CARDINAL_DIRECTIONS) {
        const next = {
          x: current.x + direction.dx,
          y: current.y + direction.dy,
          distance: current.distance + 1,
        };
        const key = `${next.x},${next.y}`;
        if (visited.has(key)) {
          continue;
        }
        visited.add(key);
        queue.push(next);
      }
    }

    const abilitySummary = formatAbilitySummary(abilityScore, sniffRange);

    if (!found) {
      await say({
        text: `You sniff the air. ${abilitySummary} No monsters are within range.`,
      });
      return;
    }

    const { monsters, location } = found;
    const dx = location.x - origin.x;
    const dy = location.y - origin.y;
    const directionText = formatDirection(dx, dy);
    const distance = location.distance;
    const distanceText =
      distance === 0
        ? 'right here on your tile'
        : `${distance} tile${distance === 1 ? '' : 's'} to the ${directionText}`;
    const coordinateText =
      distance === 0 ? '' : ` (around ${location.x}, ${location.y})`;

    const [primary, ...others] = monsters;
    const additionalText =
      others.length === 0
        ? ''
        : others.length === 1
          ? ' and another monster'
          : ` and ${others.length} more monsters`;
    const monsterText = `${primary.name}${additionalText}`;

    const message =
      distance === 0
        ? `You sniff the air. ${abilitySummary} The scent of ${monsterText} is ${distanceText}!`
        : `You sniff the air. ${abilitySummary} You catch the scent of ${monsterText} about ${distanceText}${coordinateText}.`;

    await say({ text: message });
  } catch (err) {
    const errorMessage = getUserFriendlyErrorMessage(
      err,
      'Failed to sniff for monsters',
    );
    await say({ text: errorMessage });
  }
};

registerHandler(COMMANDS.SNIFF, sniffHandler);
