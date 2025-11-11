import { equip } from '../dm-client';
import { COMMANDS } from '../commands';
import { registerHandler } from './handlerRegistry';
import type { HandlerContext } from './types';
import { getUserFriendlyErrorMessage } from './errorUtils';
import { buildItemActionMessage } from '../utils/itemDisplay';

export const equipHandler = async ({
  userId,
  say,
  text,
  teamId,
}: HandlerContext) => {
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
      teamId,
      userId,
      playerItemId,
      slot,
    });
    if (res && res.success) {
      const successText =
        buildItemActionMessage(
          'Equipped',
          res.data,
          res.message ?? `Equipped item ${playerItemId} to ${slot}.`,
          { suffix: `to ${slot}` },
        ) ?? res.message ?? `Equipped item ${playerItemId} to ${slot}.`;
      await say({
        text: successText,
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
