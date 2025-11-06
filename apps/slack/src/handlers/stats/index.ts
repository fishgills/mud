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
import { toClientId } from '../../utils/clientId';

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
  const missingCharacterMessage = `You don't have a character yet! Use "${COMMANDS.NEW} CharacterName" to create one.`;

  try {
    const target = await resolveTarget(text, userId, resolveUserId);

    if (target.isSelf) {
      const { player, message } = await fetchPlayerRecord(
        { slackId: toClientId(userId, teamId) },
        missingCharacterMessage,
      );
      await respondWithPlayer(say, player, message, missingCharacterMessage, {
        isSelf: true,
      });
      return;
    }

    if (target.slackId) {
      const isSelfLookup = target.slackId === userId;
      const targetDescription = `<@${target.slackId}>`;
      const fallbackMessage = isSelfLookup
        ? missingCharacterMessage
        : `I couldn't find a character for ${targetDescription}.`;
      const { player, message } = await fetchPlayerRecord(
        { slackId: toClientId(target.slackId, teamId) },
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
      missingCharacterMessage,
      teamId,
    );
    if (!self.player) {
      await say({ text: self.error ?? missingCharacterMessage });
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
            isSelf: matchingPlayers[0].slackId === userId,
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
    const { player, message } = await fetchPlayerRecord(
      { name: target.cleanedTarget },
      fallbackMessage,
    );
    await respondWithPlayer(say, player, message, fallbackMessage, {
      isSelf: player?.slackId === userId,
    });
  } catch (err: unknown) {
    console.error('Error fetching player stats:', err);
    const errorMessage = getUserFriendlyErrorMessage(
      err,
      'Failed to load stats',
    );
    await say({ text: errorMessage });
  }
};

registerHandler(COMMANDS.STATS, statsHandler);
