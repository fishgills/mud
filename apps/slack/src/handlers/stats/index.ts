import { COMMANDS } from '../../commands';
import { registerHandler } from '../handlerRegistry';
import { getUserFriendlyErrorMessage } from '../errorUtils';
import { HandlerContext } from '../types';
import { buildPlayerStatsMessage } from './format';
import { fetchPlayerRecord } from './lookup';
import { resolveTarget } from './target';
import { PlayerStatsSource } from './types';
import { MISSING_CHARACTER_MESSAGE } from '../characterUtils';

export const statsHandlerHelp = `Show stats with "${COMMANDS.STATS}". Example: Send "${COMMANDS.STATS}" for yourself or "${COMMANDS.STATS} @player" to inspect another adventurer.`;

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

    if (target.targetUserId) {
      const isSelfLookup = target.targetUserId === userId;
      const targetDescription = `<@${target.targetUserId}>`;
      const fallbackMessage = isSelfLookup
        ? MISSING_CHARACTER_MESSAGE
        : `I couldn't find a character for ${targetDescription}.`;
      const { player, message } = await fetchPlayerRecord(
        { teamId, userId: target.targetUserId },
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

    await say({
      text: `Try a Slack mention like \`${COMMANDS.STATS} @player\` to inspect someone else.`,
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
