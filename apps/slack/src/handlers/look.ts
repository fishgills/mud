import { HandlerContext } from './types';
import { COMMANDS } from '../commands';
import { getOccupantsSummaryAt, sendItemsSummary } from './locationUtils';
import { PlayerCommandHandler } from './base';

export const lookHandlerHelp = `Look around with enhanced vision based on terrain height. Returns a panoramic description, visible peaks, nearby settlements, and biome summary. Example: Send 'look' or 'l'.`;

type Perf = {
  totalMs: number;
  playerMs: number;
  worldCenterNearbyMs: number;
  worldBoundsTilesMs: number;
  worldExtendedBoundsMs: number;
  tilesFilterMs: number;
  peaksSortMs: number;
  biomeSummaryMs: number;
  settlementsFilterMs: number;
  aiMs: number;
  aiProvider: string;
};

export class LookHandler extends PlayerCommandHandler {
  constructor() {
    super([COMMANDS.LOOK, COMMANDS.LOOK_SHORT], 'Failed to look around');
  }

  protected async perform({ userId, say }: HandlerContext): Promise<void> {
    const res = await this.dm.getLookView({
      teamId: this.teamId,
      userId,
    });
    if (!res.success || !res.data) {
      await say({
        text: `Failed to look: ${res.message ?? 'unknown error'}`,
      });
      return;
    }

    if (res.data.description) {
      await say({ text: res.data.description });
    }

    const center = res.data.location;
    if (
      !center ||
      typeof center.x !== 'number' ||
      typeof center.y !== 'number'
    ) {
      await say({ text: 'Unable to determine your current location.' });
      return;
    }

    const occupants = await getOccupantsSummaryAt(center.x, center.y, {
      currentSlackUserId: userId,
      currentClientId: `${this.teamId}:${userId}`,
    });
    if (occupants) {
      await say({ text: occupants });
    }

    // If the DM returned any world items at the player's location, show them.
    // Use the shared helper so item rendering follows the same pattern as players/monsters.
    const maybeItems = (res.data as unknown as { items?: unknown } | undefined)
      ?.items;
    if (maybeItems) {
      await sendItemsSummary(
        say,
        maybeItems as Array<Record<string, unknown>> | undefined,
      );
    }

    const perf: Perf | undefined = res.perf as Perf | undefined;
    if (perf) {
      const summary = `Perf: total ${perf.totalMs}ms (player ${perf.playerMs}ms, world center+nearby ${perf.worldCenterNearbyMs}ms, bounds ${perf.worldBoundsTilesMs}ms, ext ${perf.worldExtendedBoundsMs}ms, tiles filter ${perf.tilesFilterMs}ms, peaks ${perf.peaksSortMs}ms, biome ${perf.biomeSummaryMs}ms, settlements ${perf.settlementsFilterMs}ms, AI[${perf.aiProvider}] ${perf.aiMs}ms)`;
      await say({ text: summary });
    }
  }
}

export const lookHandler = new LookHandler();
