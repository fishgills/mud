import { dmSdk } from '../gql-client';
import { HandlerContext } from './types';
import { registerHandler } from './handlerRegistry';
import { getUserFriendlyErrorMessage } from './errorUtils';
import { COMMANDS } from '../commands';
import { toClientId } from '../utils/clientId';

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

export const lookHandler = async ({ userId, say }: HandlerContext) => {
  try {
    const res = await dmSdk.GetLookView({ slackId: toClientId(userId) });
    if (!res.getLookView.success || !res.getLookView.data) {
      await say({
        text: `Failed to look: ${res.getLookView.message ?? 'unknown error'}`,
      });
      return;
    }
    // Send the panoramic description as the primary message
    await say({ text: res.getLookView.data.description });

    const monsters = res.getLookView.data.monsters;
    if (monsters && monsters.length > 0) {
      await say({ text: `You see the following monsters:` });
      for (const monster of monsters) {
        await say({ text: `- ${monster.name}` });
      }
    }
    // Show performance stats summary if available
    const perf: Perf | undefined = (
      res.getLookView as unknown as {
        perf?: Perf;
      }
    )?.perf;
    if (perf) {
      const summary = `Perf: total ${perf.totalMs}ms (player ${perf.playerMs}ms, world center+nearby ${perf.worldCenterNearbyMs}ms, bounds ${perf.worldBoundsTilesMs}ms, ext ${perf.worldExtendedBoundsMs}ms, tiles filter ${perf.tilesFilterMs}ms, peaks ${perf.peaksSortMs}ms, biome ${perf.biomeSummaryMs}ms, settlements ${perf.settlementsFilterMs}ms, AI[${perf.aiProvider}] ${perf.aiMs}ms)`;
      await say({ text: summary });
    }

    // await sendDebugJson(say, res.getLookView.data);
  } catch (err: unknown) {
    const errorMessage = getUserFriendlyErrorMessage(
      err,
      'Failed to look around',
    );
    await say({ text: errorMessage });
  }
};

// Register handlers for look commands
registerHandler(COMMANDS.LOOK, lookHandler);
registerHandler(COMMANDS.LOOK_SHORT, lookHandler);
