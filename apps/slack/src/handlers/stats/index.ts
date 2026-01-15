import { COMMANDS } from '../../commands';
import { registerHandler } from '../handlerRegistry';
import { getUserFriendlyErrorMessage } from '../errorUtils';
import { HandlerContext } from '../types';
import { fetchPlayerRecord } from './lookup';
import { resolveTarget } from './target';
import { PlayerStatsSource } from './types';
import { MISSING_CHARACTER_MESSAGE } from '../characterUtils';
import { buildCharacterSheetModal } from './modal';

export const statsHandlerHelp = `Open the character sheet with "${COMMANDS.STATS}". Example: Send "${COMMANDS.STATS}" for yourself or "${COMMANDS.STATS} @player" to inspect another adventurer.`;

async function respondWithPlayer(
  say: HandlerContext['say'],
  player: PlayerStatsSource | undefined,
  message: string | undefined,
  fallbackMessage: string,
  options: {
    isSelf?: boolean;
    triggerId?: string;
    client?: HandlerContext['client'];
    teamId?: string;
    userId?: string;
  } = {},
) {
  if (player) {
    if (
      options.client?.views?.open &&
      options.teamId &&
      options.userId &&
      options.triggerId
    ) {
      await options.client.views.open({
        trigger_id: options.triggerId,
        view: buildCharacterSheetModal(player, {
          teamId: options.teamId,
          userId: options.userId,
          isSelf: Boolean(options.isSelf),
        }),
      });
      return;
    }
    await say({
      text: 'Open the Home tab and select View Stats to see your character sheet.',
    });
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
  client,
  triggerId,
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
        triggerId,
        client,
        teamId,
        userId,
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
        triggerId,
        client,
        teamId,
        userId,
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
