import { COMMANDS } from '../../commands';
import { registerHandler } from '../handlerRegistry';
import { getUserFriendlyErrorMessage } from '../errorUtils';
import { HandlerContext } from '../types';
import { buildMonsterStatsMessage, buildPlayerStatsMessage } from './format';
import {
  fetchPlayerRecord,
  fetchPlayerWithLocation,
  findNearbyMatches,
} from './lookup';
import { resolveTarget } from './target';
import { PlayerStatsSource } from './types';
import { MISSING_CHARACTER_MESSAGE } from '../characterUtils';

export const statsHandlerHelp = `Show stats with "${COMMANDS.STATS}". Example: Send "${COMMANDS.STATS}" for yourself, "${COMMANDS.STATS} Alice" to inspect another adventurer, or "${COMMANDS.STATS} Goblin" to scout a nearby monster.`;

async function respondWithPlayer(
  say: HandlerContext['say'],
  player: PlayerStatsSource | undefined,
  message: string | undefined,
  fallbackMessage: string,
  options: { isSelf?: boolean } = {},
) {
  if (player) {
    await say(buildPlayerStatsMessage(player, { isSelf: options.isSelf }));
    return;
  }

  await say({ text: message ?? fallbackMessage });
}

export const statsHandler = async ({
  userId,
  say,
  text,
  resolveUserId,
  teamId,
}: HandlerContext) => {
  try {
    const target = await resolveTarget(text, userId, resolveUserId);

    if (target.isSelf) {
      const { player, message } = await fetchPlayerRecord(
        { teamId, userId },
        MISSING_CHARACTER_MESSAGE,
      );
      await respondWithPlayer(say, player, message, MISSING_CHARACTER_MESSAGE, {
        isSelf: true,
      });
      return;
    }

    if (target.slackId) {
      const isSelfLookup = target.slackId === userId;
      const targetDescription = `<@${target.slackId}>`;
      const fallbackMessage = isSelfLookup
        ? MISSING_CHARACTER_MESSAGE
        : `I couldn't find a character for ${targetDescription}.`;
      const { player, message } = await fetchPlayerRecord(
        { teamId, userId: target.slackId },
        fallbackMessage,
      );
      await respondWithPlayer(say, player, message, fallbackMessage, {
        isSelf: isSelfLookup,
      });
      return;
    }

    if (!target.cleanedTarget) {
      await say({
        text: `I couldn't figure out who you're trying to inspect.`,
      });
      return;
    }

    const self = await fetchPlayerWithLocation(
      userId,
      MISSING_CHARACTER_MESSAGE,
      teamId,
    );
    if (!self.player) {
      await say({ text: self.error ?? MISSING_CHARACTER_MESSAGE });
      return;
    }

    const { matchingPlayers, matchingMonsters, totalMatches } =
      findNearbyMatches(
        target.cleanedTarget,
        self.playersHere,
        self.monstersHere,
      );

    if (totalMatches === 1) {
      if (matchingPlayers.length === 1) {
        await say(
          buildPlayerStatsMessage(matchingPlayers[0], {
            isSelf: matchingPlayers[0].slackUser?.userId === userId,
          }),
        );
        return;
      }
      if (matchingMonsters.length === 1) {
        await say(buildMonsterStatsMessage(matchingMonsters[0]));
        return;
      }
    }

    if (totalMatches > 1) {
      await say({
        text: `Multiple beings named "${target.cleanedTarget}" are nearby. Try using a Slack mention or be more specific.`,
      });
      return;
    }

    const fallbackMessage = `I couldn't find a character named ${target.cleanedTarget}.`;
    // Multiple or zero matches found - show the result counts
    await say({
      text: fallbackMessage,
    });
  } catch (err: unknown) {
    const errorMessage = getUserFriendlyErrorMessage(
      err,
      'Failed to load stats',
    );
    await say({ text: errorMessage });
  }
};

registerHandler(COMMANDS.STATS, statsHandler);
