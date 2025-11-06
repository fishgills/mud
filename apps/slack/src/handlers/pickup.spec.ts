jest.mock('../dm-client', () => {
  const dmClient = {
    getPlayer: jest.fn(),
    getLocationEntities: jest.fn(),
    pickup: jest.fn(),
  };
  return { dmClient };
});

import { registerActions } from '../actions';
import { dmClient } from '../dm-client';
import { PICKUP_ACTIONS } from '../commands';
import { buildItemSelectionMessage, ITEM_SELECTION_BLOCK_ID } from './pickup';
import { toClientId } from '../utils/clientId';
import type { App } from '@slack/bolt';
import { ItemRecord } from '../dm-client';

const mockedDmClient = dmClient as unknown as {
  getPlayer: jest.Mock;
  getLocationEntities: jest.Mock;
  pickup: jest.Mock;
};

type AckMock = jest.Mock<Promise<void>, unknown[]>;
type ConversationsOpenMock = jest.Mock<
  Promise<{ channel: { id: string } | null }>,
  unknown[]
>;
type ChatPostMessageMock = jest.Mock<Promise<void>, unknown[]>;
type ChatUpdateMock = jest.Mock<Promise<void>, unknown[]>;

type MockSlackClient = {
  conversations: { open: ConversationsOpenMock };
  chat: { postMessage: ChatPostMessageMock; update: ChatUpdateMock };
};

type ActionHandler = (args: {
  ack?: AckMock | (() => Promise<void>);
  body?: Record<string, unknown>;
  client?: unknown;
}) => Promise<unknown> | unknown;

type SlackBlock = { block_id?: string; elements?: unknown[] };

type StateValues = Record<
  string,
  Record<
    string,
    { selected_option?: { value?: string; text?: { text?: string } } }
  >
>;

describe('pickup actions', () => {
  let actionHandlers: Record<string, ActionHandler> = {};

  beforeEach(() => {
    actionHandlers = {};
    mockedDmClient.getPlayer.mockReset();
    mockedDmClient.getLocationEntities.mockReset();
    mockedDmClient.pickup.mockReset();

    const app = {
      action: jest.fn((actionId: string, handler: ActionHandler) => {
        actionHandlers[actionId] = handler;
      }),
      view: jest.fn(),
    } as unknown as App;

    registerActions(app);
  });

  test('buildItemSelectionMessage creates proper blocks', () => {
    const items: ItemRecord[] = [{ id: 101, itemName: 'Potion', quantity: 3 }];
    const msg = buildItemSelectionMessage(items);
    expect(msg).toBeDefined();
    const actionsBlock = msg.blocks.find(
      (b: SlackBlock) => b.block_id === ITEM_SELECTION_BLOCK_ID,
    ) as SlackBlock | undefined;
    expect(actionsBlock).toBeDefined();
    const select = (
      (actionsBlock?.elements ?? []) as Array<Record<string, unknown>>
    ).find((e) => (e as Record<string, unknown>).type === 'static_select') as
      | Record<string, unknown>
      | undefined;
    expect(select).toBeDefined();
    expect(
      ((select?.options ?? []) as Array<Record<string, unknown>>)[0].value,
    ).toBe('W:101');
  });

  test('PICKUP action calls dmClient.pickup and DMs players', async () => {
    const ack = jest.fn().mockResolvedValue(undefined) as AckMock;

    // Mock dm client responses
    mockedDmClient.pickup.mockResolvedValue({
      success: true,
      item: { itemName: 'Potion', quantity: 3 },
    });
    mockedDmClient.getPlayer.mockResolvedValue({
      success: true,
      data: { id: 1, name: 'Hero', x: 5, y: 6 },
    });
    mockedDmClient.getLocationEntities.mockResolvedValue({
      players: [{ slackId: 'U2', name: 'Other' }],
      monsters: [],
    });

    const mockClient: MockSlackClient = {
      conversations: {
        open: jest.fn().mockResolvedValue({
          channel: { id: 'D_PICKER' },
        }) as ConversationsOpenMock,
      },
      chat: {
        postMessage: jest
          .fn()
          .mockResolvedValue(undefined) as ChatPostMessageMock,
        update: jest.fn().mockResolvedValue(undefined) as ChatUpdateMock,
      },
    };

    // Simulate the action payload body with selected option
    const stateValues: StateValues = {} as StateValues;
    stateValues[ITEM_SELECTION_BLOCK_ID] = {};
    stateValues[ITEM_SELECTION_BLOCK_ID][PICKUP_ACTIONS.ITEM_SELECT] = {
      selected_option: { value: 'W:101', text: { text: 'Potion' } },
    };

    await actionHandlers[PICKUP_ACTIONS.PICKUP]!({
      ack,
      body: {
        user: { id: 'U1' },
        team: { id: 'T1' },
        channel: { id: 'C1' },
        message: {
          ts: '123',
          blocks: buildItemSelectionMessage([
            { id: 101, itemName: 'Potion', quantity: 3 },
          ] as ItemRecord[]).blocks,
        },
        state: { values: stateValues },
      },
      client: mockClient as unknown,
      context: { teamId: 'T1' },
    });

    expect(mockedDmClient.pickup).toHaveBeenCalledWith({
      slackId: toClientId('U1', 'T1'),
      worldItemId: 101,
    });

    // Picker DM should be sent
    expect(mockClient.conversations.open).toHaveBeenCalledWith({ users: 'U1' });
    expect(mockClient.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'D_PICKER',
        text: expect.stringContaining('You have picked up'),
      }),
    );

    // Other player should be DM'd too
    expect(mockClient.conversations.open).toHaveBeenCalledWith({ users: 'U2' });
    expect(mockClient.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('picked something up'),
      }),
    );
  });
});
