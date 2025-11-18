import { getLocationEntities, ItemRecord } from '../dm-client';
import { COMMANDS, PICKUP_ACTIONS } from '../commands';
import type { HandlerContext } from './types';
import { getUserFriendlyErrorMessage } from './errorUtils';
import { PlayerCommandHandler } from './base';

export const ITEM_SELECTION_BLOCK_ID = 'pickup_item_selection_block';

export function buildItemSelectionMessage(items: Array<ItemRecord>) {
  const itemList = (items || []).map((it) => it.item?.name).join(', ');
  const options = (items || []).map((it) => {
    const id = String(it.id ?? '');
    const name = it.item?.name;
    const quality =
      typeof it.quality === 'string' && it.quality ? ` (${it.quality})` : '';
    const qty =
      typeof it.quantity === 'number' && it.quantity > 1
        ? ` (x${it.quantity})`
        : '';
    return {
      text: {
        type: 'plain_text' as const,
        text: `${name}${quality}${qty}`,
        emoji: true,
      },
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

class PickupHandler extends PlayerCommandHandler {
  constructor() {
    super(COMMANDS.PICKUP, 'Failed to list items', {
      allowInHq: false,
      hqCommand: COMMANDS.PICKUP,
      missingCharacterMessage: 'Could not find your player.',
    });
  }

  protected async perform({ say }: HandlerContext): Promise<void> {
    const player = this.player;
    if (!player) {
      return;
    }

    const { x, y } = player;
    if (typeof x !== 'number' || typeof y !== 'number') {
      await say({ text: 'Unable to determine your current location.' });
      return;
    }

    try {
      const entities = await getLocationEntities({ x, y });
      const items: ItemRecord[] = entities.items ?? [];

      if (!items || items.length === 0) {
        await say({ text: 'No items here to pick up!' });
        return;
      }

      await say(buildItemSelectionMessage(items));
    } catch (err) {
      const message = getUserFriendlyErrorMessage(err, 'Failed to list items');
      await say({ text: message });
    }
  }

  protected override getFriendlyError(error: unknown): string {
    return getUserFriendlyErrorMessage(error, 'Failed to list items');
  }
}

export const pickupHandler = new PickupHandler();
