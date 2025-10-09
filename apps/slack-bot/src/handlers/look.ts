import { HandlerContext } from './types';
import { COMMANDS } from '../commands';
import { getOccupantsSummaryAt } from './locationUtils';
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
    const res = await this.sdk.GetLookView({
      slackId: this.toClientId(userId),
    });
    if (!res.getLookView.success || !res.getLookView.data) {
      await say({
        text: `Failed to look: ${res.getLookView.message ?? 'unknown error'}`,
      });
      return;
    }

    await say({ text: res.getLookView.data.description });

    const center = res.getLookView.data.location;
    const occupants = await getOccupantsSummaryAt(center.x, center.y, userId);
    if (occupants) {
      await say({ text: occupants });
    }

    const perf: Perf | undefined = (
      res.getLookView as unknown as {
        perf?: Perf;
      }
    )?.perf;
    if (perf) {
      const summary = `Perf: total ${perf.totalMs}ms (player ${perf.playerMs}ms, world center+nearby ${perf.worldCenterNearbyMs}ms, bounds ${perf.worldBoundsTilesMs}ms, ext ${perf.worldExtendedBoundsMs}ms, tiles filter ${perf.tilesFilterMs}ms, peaks ${perf.peaksSortMs}ms, biome ${perf.biomeSummaryMs}ms, settlements ${perf.settlementsFilterMs}ms, AI[${perf.aiProvider}] ${perf.aiMs}ms)`;
      await say({ text: summary });
    }
  }
}

export const lookHandler = new LookHandler();
