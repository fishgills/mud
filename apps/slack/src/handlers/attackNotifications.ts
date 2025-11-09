import type { WebClient } from '@slack/web-api';
import { COMMANDS } from '../commands';

type FailureMessageOptions = {
  targetKind?: 'player' | 'monster';
  targetName?: string;
};

const DEFAULT_FAILURE = 'Attack failed.';

const normalizeTargetName = (name?: string): string =>
  name?.trim().length ? name.trim() : 'that player';

export const buildMissingCharacterGuidance = (targetName: string): string =>
  `Couldn't find a character for ${targetName}. Ask them to check in with the bot using "${COMMANDS.HELP}" or create one with "${COMMANDS.NEW} <name>".`;

export const buildTargetAttackAttemptNotice = (
  attackerSlackId: string | undefined,
): string => {
  const attackerLabel = attackerSlackId ? `<@${attackerSlackId}>` : 'Someone';
  return `${attackerLabel} tried to attack you in *Mud*, but you don't have a character yet. Use "${COMMANDS.NEW} <name>" to jump in.`;
};

export const isMissingTargetCharacterMessage = (
  rawMessage: string | undefined | null,
): boolean => {
  const message = rawMessage?.toLowerCase() ?? '';
  if (!message) return false;
  return (
    message.includes('target player not found') ||
    message.includes('player not found') ||
    message.includes('no valid identifier') ||
    message.includes('no character')
  );
};

export const buildAttackFailureMessage = (
  rawMessage: string | undefined | null,
  options: FailureMessageOptions = {},
): string => {
  const fallback = rawMessage
    ? `Attack failed: ${rawMessage}`
    : DEFAULT_FAILURE;
  if (options.targetKind !== 'player') {
    return fallback;
  }

  const message = rawMessage?.toLowerCase() ?? '';
  if (!message) return fallback;

  const targetName = normalizeTargetName(options.targetName);

  if (message.includes('not alive')) {
    return `${targetName} is down right now. Wait for them to respawn before trying again.`;
  }

  if (isMissingTargetCharacterMessage(rawMessage)) {
    return buildMissingCharacterGuidance(targetName);
  }

  return fallback;
};

export const notifyTargetAboutMissingCharacter = async (
  client: WebClient | undefined,
  attackerSlackId: string | undefined,
  targetSlackId: string,
): Promise<void> => {
  if (!client) return;
  if (!targetSlackId) return;
  if (attackerSlackId && attackerSlackId === targetSlackId) return;

  const dm = await client.conversations.open({ users: targetSlackId });
  const dmChannelId =
    typeof dm.channel?.id === 'string' ? dm.channel.id : undefined;
  if (!dmChannelId) return;

  await client.chat.postMessage({
    channel: dmChannelId,
    text: buildTargetAttackAttemptNotice(attackerSlackId),
  });
};
