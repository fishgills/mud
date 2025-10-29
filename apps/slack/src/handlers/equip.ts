import { equip } from '../dm-client';
import { COMMANDS } from '../commands';
import { registerHandler } from './handlerRegistry';
import type { HandlerContext } from './types';
import { toClientId } from '../utils/clientId';
import { getUserFriendlyErrorMessage } from './errorUtils';

export const equipHandler = async ({ userId, say, text }: HandlerContext) => {
  const args = (text || '').trim().split(/\s+/).slice(1);
  const playerItemIdArg = args[0];
  const slot = args[1];
  if (!playerItemIdArg || !slot) {
    await say({ text: `Usage: ${COMMANDS.EQUIP} <playerItemId> <slot>` });
    return;
  }

  const playerItemId = Number(playerItemIdArg);
  if (!Number.isFinite(playerItemId) || playerItemId <= 0) {
    await say({ text: `Invalid playerItemId: ${playerItemIdArg}` });
    return;
  }

  try {
    const res = await equip({
      slackId: toClientId(userId),
      playerItemId,
      slot,
    });
    if (res && res.success) {
      await say({
        text: res.message ?? `Equipped item ${playerItemId} to ${slot}.`,
      });
    } else {
      await say({ text: res?.message ?? 'Failed to equip item.' });
    }
  } catch (err) {
    const message = getUserFriendlyErrorMessage(err, 'Failed to equip item');
    await say({ text: message });
  }
};

registerHandler(COMMANDS.EQUIP, equipHandler);
