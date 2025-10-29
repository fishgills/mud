import { drop } from '../dm-client';
import { COMMANDS } from '../commands';
import { registerHandler } from './handlerRegistry';
import type { HandlerContext } from './types';
import { toClientId } from '../utils/clientId';
import { getUserFriendlyErrorMessage } from './errorUtils';

export const dropHandler = async ({ userId, say, text }: HandlerContext) => {
  const args = (text || '').trim().split(/\s+/).slice(1);
  const playerItemIdArg = args[0];
  if (!playerItemIdArg) {
    await say({ text: `Usage: ${COMMANDS.DROP} <playerItemId>` });
    return;
  }

  const playerItemId = Number(playerItemIdArg);
  if (!Number.isFinite(playerItemId) || playerItemId <= 0) {
    await say({ text: `Invalid playerItemId: ${playerItemIdArg}` });
    return;
  }

  try {
    const res = await drop({ slackId: toClientId(userId), playerItemId });
    if (res && res.success) {
      await say({ text: res.message ?? `Dropped item ${playerItemId}.` });
    } else {
      await say({ text: res?.message ?? 'Failed to drop item.' });
    }
  } catch (err) {
    const message = getUserFriendlyErrorMessage(err, 'Failed to drop item');
    await say({ text: message });
  }
};

registerHandler(COMMANDS.DROP, dropHandler);
