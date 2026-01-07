import { HandlerContext } from './types';
import { COMMANDS } from '../commands';
import { getOccupantsSummaryAt, sendItemsSummary } from './locationUtils';
import { PlayerCommandHandler } from './base';

export const lookHandlerHelp = `Look around with enhanced vision based on terrain height. Returns a panoramic description, visible peaks, and a biome summary. Example: Send 'look' or 'l'.`;

type Perf = {
  totalMs: number;
  playerMs: number;
  worldCenterNearbyMs: number;
  worldBoundsTilesMs: number;
  worldExtendedBoundsMs: number;
  tilesFilterMs: number;
  peaksSortMs: number;
  biomeSummaryMs: number;
  aiMs: number;
  tilesCount: number;
  peaksCount: number;
  aiProvider: string;
};

export class LookHandler extends PlayerCommandHandler {
  constructor() {
    super([COMMANDS.LOOK, COMMANDS.LOOK_SHORT], 'Failed to look around', {
      allowInHq: false,
      hqCommand: COMMANDS.LOOK,
      missingCharacterMessage:
        'Could not find your player. Use "new CharacterName" to create one.',
    });
  }

  protected async perform({ userId, say }: HandlerContext): Promise<void> {
    const res = await this.dm.getLookView({
      teamId: this.teamId!,
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

    if (!this.player?.hasMoved) {
      await say({
        text: 'Tip: Move with `north`, `south`, `east`, or `west` (or `n`, `s`, `e`, `w`).',
      });
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
      currentSlackTeamId: this.teamId,
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
      const summary = `Perf: total ${perf.totalMs}ms (player ${perf.playerMs}ms, world center+nearby ${perf.worldCenterNearbyMs}ms, bounds ${perf.worldBoundsTilesMs}ms, ext ${perf.worldExtendedBoundsMs}ms, tiles filter ${perf.tilesFilterMs}ms, peaks ${perf.peaksSortMs}ms, biome ${perf.biomeSummaryMs}ms, AI[${perf.aiProvider}] ${perf.aiMs}ms, tiles ${perf.tilesCount}, peaks ${perf.peaksCount})`;
      await say({ text: summary });
    }
  }
}

export const lookHandler = new LookHandler();
