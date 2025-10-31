import {
  pickup,
  getPlayer,
  getLocationEntities,
  getLookView,
  ItemRecord,
} from '../dm-client';
import { COMMANDS, PICKUP_ACTIONS } from '../commands';
import { registerHandler } from './handlerRegistry';
import type { HandlerContext } from './types';
import { toClientId } from '../utils/clientId';
import {
  getUserFriendlyErrorMessage,
  mapErrCodeToFriendlyMessage,
} from './errorUtils';

export const ITEM_SELECTION_BLOCK_ID = 'pickup_item_selection_block';

export function buildItemSelectionMessage(items: Array<ItemRecord>) {
  const itemList = (items || [])
    .map((it) => it.itemName ?? `Item ${it.id}`)
    .join(', ');
  const options = (items || []).map((it) => {
    const id = String(it.id ?? '');
    const name = it.itemName ?? `Item ${id}`;
    const qty =
      typeof it.quantity === 'number' && it.quantity > 1
        ? ` (x${it.quantity})`
        : '';
    return {
      text: { type: 'plain_text' as const, text: `${name}${qty}`, emoji: true },
      value: `W:${id}`,
    };
  });

  const firstOption = options[0];

  const headerText = itemList
    ? `You see the following at your location — items: ${itemList}`
    : 'Choose an item to pick up:';

  return {
    text: 'Choose an item to pick up',
    blocks: [
      {
        type: 'section' as const,
        text: { type: 'mrkdwn' as const, text: headerText },
      },
      {
        type: 'actions' as const,
        block_id: ITEM_SELECTION_BLOCK_ID,
        elements: [
          {
            type: 'static_select' as const,
            action_id: PICKUP_ACTIONS.ITEM_SELECT,
            placeholder: {
              type: 'plain_text' as const,
              text: 'Select an item',
              emoji: true,
            },
            options,
            ...(firstOption ? { initial_option: firstOption } : {}),
          },
          {
            type: 'button' as const,
            action_id: PICKUP_ACTIONS.PICKUP,
            text: { type: 'plain_text' as const, text: 'Pick up', emoji: true },
            style: 'primary' as const,
            value: 'pickup_item',
          },
        ],
      },
    ],
  };
}

export const pickupHandler = async ({ userId, say, text }: HandlerContext) => {
  const args = (text || '').trim().split(/\s+/).slice(1);
  const worldItemIdArg = args[0];

  // Numeric-argument path: keep existing behavior
  if (worldItemIdArg) {
    const worldItemId = Number(worldItemIdArg);
    if (!Number.isFinite(worldItemId) || worldItemId <= 0) {
      await say({ text: `Invalid worldItemId: ${worldItemIdArg}` });
      return;
    }

    try {
      const res = await pickup({ slackId: toClientId(userId), worldItemId });
      if (res && res.success) {
        await say({ text: res.message ?? 'You picked up an item.' });
      } else {
        const getCode = (v: unknown): string | undefined => {
          if (v && typeof v === 'object' && 'code' in v) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return (v as any).code as string | undefined;
          }
          return undefined;
        };

        const friendly = mapErrCodeToFriendlyMessage(getCode(res));
        await say({
          text: friendly ?? res?.message ?? 'Failed to pick up item.',
        });
      }
    } catch (err) {
      const message = getUserFriendlyErrorMessage(
        err,
        'Failed to pick up item',
      );
      await say({ text: message });
    }

    return;
  }

  // Selection flow: show dropdown of nearby items
  try {
    const playerRes = await getPlayer({ slackId: toClientId(userId) });
    const player = playerRes.data;
    if (!player) {
      await say({ text: 'Could not find your player.' });
      return;
    }
    const { x, y } = player;
    if (typeof x !== 'number' || typeof y !== 'number') {
      await say({ text: 'Unable to determine your current location.' });
      return;
    }

    // Try getLocationEntities first, but fall back to getLookView for items
    const entities = await getLocationEntities({ x, y });
    // Prefer items on entities if backend provides them; otherwise use look view
    let items: ItemRecord[] = entities.items ?? [];
    if (!items || items.length === 0) {
      const look = await getLookView({ slackId: toClientId(userId) });
      // look.data is a JsonMap and may contain an items array; narrow via unknown cast
      items = (look?.data as unknown as { items?: ItemRecord[] })?.items ?? [];
    }

    if (!items || items.length === 0) {
      await say({ text: 'No items here to pick up!' });
      return;
    }

    await say(buildItemSelectionMessage(items));
  } catch (err) {
    const message = getUserFriendlyErrorMessage(err, 'Failed to list items');
    await say({ text: message });
  }
};

registerHandler(COMMANDS.PICKUP, pickupHandler);
