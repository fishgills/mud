import type { BlockAction } from '@slack/bolt';
import type { WebClient } from '@slack/web-api';
import { inspectHandler, INSPECT_SELECTION_BLOCK_ID } from './inspect';
import { INSPECT_ACTIONS, COMMANDS } from '../commands';
import { dmClient } from '../dm-client';
import { buildHqBlockedMessage } from './hqUtils';

jest.mock('../dm-client', () => {
  const fn = jest.fn;
  return {
    dmClient: {
      getPlayer: fn(),
      getLocationEntities: fn(),
      getLookView: fn(),
      getItemDetails: fn(),
      getMonsterById: fn(),
    },
  };
});

const mockAck = () => jest.fn().mockResolvedValue(undefined);

const buildActionBody = (selectedValue?: string): BlockAction => {
  const selection = selectedValue
    ? {
        selected_option: {
          value: selectedValue,
          text: { type: 'plain_text', text: 'selected', emoji: true },
        },
      }
    : undefined;

  return {
    type: 'block_actions',
    user: { id: 'U123', team_id: 'T1', username: 'tester' },
    api_app_id: 'A123',
    token: 'token',
    team: { id: 'T1', domain: 'test' },
    container: { type: 'message', channel_id: 'C123', is_ephemeral: false },
    channel: { id: 'C123', name: 'general' },
    message: {
      type: 'message',
      user: 'U123',
      ts: '123456.789',
      text: 'Inspect…',
    },
    trigger_id: 'trigger',
    response_url: 'https://example.com/respond',
    actions: [],
    state: {
      values: selection
        ? {
            [INSPECT_SELECTION_BLOCK_ID]: {
              [INSPECT_ACTIONS.TARGET_SELECT]: selection,
            },
          }
        : {},
    },
  } as unknown as BlockAction;
};

const mockClient = () => ({
  chat: {
    postMessage: jest.fn().mockResolvedValue({}),
  },
  conversations: {
    open: jest.fn().mockResolvedValue({ channel: { id: 'D123' } }),
  },
});

const mockedDmClient = dmClient as jest.Mocked<typeof dmClient>;

describe('inspectHandler.handleInspectAction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedDmClient.getMonsterById.mockReset();
  });

  it('responds with failure when no selection is present', async () => {
    const body = buildActionBody();
    mockedDmClient.getPlayer.mockResolvedValue({
      success: true,
      data: {
        id: 1,
        name: 'Inspector',
        teamId: 'T1',
        userId: 'U123',
        slackUser: { teamId: 'T1', userId: 'U123' },
        isInHq: false,
      },
    } as never);

    const client = mockClient();
    await inspectHandler.handleInspectAction({
      ack: mockAck(),
      body,
      client: client as unknown as WebClient,
    });

    expect(client.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'C123',
        text: 'No target selected to inspect.',
      }),
    );
  });

  it('sends player stats with odds when inspecting a player', async () => {
    mockedDmClient.getPlayer.mockResolvedValueOnce({
      data: {
        id: 10,
        name: 'Inspector',
        teamId: 'T1',
        userId: 'U123',
        slackUser: { teamId: 'T1', userId: 'U123' },
        x: 1,
        y: 2,
        hp: 40,
        maxHp: 50,
        strength: 12,
        agility: 11,
        health: 13,
        level: 4,
        isInHq: false,
      },
      success: true,
    } as never);
    mockedDmClient.getPlayer.mockResolvedValueOnce({
      data: {
        id: 20,
        name: 'Target',
        teamId: 'T1',
        userId: 'U456',
        slackUser: { teamId: 'T1', userId: 'U456' },
        hp: 30,
        maxHp: 45,
        strength: 10,
        agility: 12,
        health: 9,
        level: 3,
        isInHq: false,
      },
      success: true,
    } as never);

    const body = buildActionBody('P:T1:U456');
    const client = mockClient();

    await inspectHandler.handleInspectAction({
      ack: mockAck(),
      body,
      client: client as unknown as WebClient,
    });

    expect(client.chat.postMessage).toHaveBeenCalled();
    const [{ text, blocks }] = client.chat.postMessage.mock.calls[0];
    expect(text).toContain('Target');
    expect(blocks).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'context' })]),
    );
  });

  it('sends monster stats with odds when inspecting a monster', async () => {
    mockedDmClient.getPlayer.mockResolvedValue({
      data: {
        id: 10,
        name: 'Inspector',
        teamId: 'T1',
        userId: 'U123',
        slackUser: { teamId: 'T1', userId: 'U123' },
        x: 5,
        y: 5,
        hp: 40,
        maxHp: 50,
        strength: 12,
        agility: 11,
        health: 13,
        level: 4,
        isInHq: false,
      },
      success: true,
    } as never);

    mockedDmClient.getLocationEntities.mockResolvedValue({
      players: [],
      monsters: [
        {
          id: 99,
          name: 'Goblin',
          hp: 12,
          maxHp: 12,
          strength: 8,
          agility: 9,
          health: 7,
          isAlive: true,
        },
      ],
      items: [],
    });
    mockedDmClient.getMonsterById.mockResolvedValue({
      id: 99,
      name: 'Goblin',
      hp: 12,
      maxHp: 12,
      strength: 8,
      agility: 9,
      health: 7,
      level: 2,
      isAlive: true,
    });

    const body = buildActionBody('M:99');
    const client = mockClient();

    await inspectHandler.handleInspectAction({
      ack: mockAck(),
      body,
      client: client as unknown as WebClient,
    });

    expect(client.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'C123',
        text: expect.stringContaining('Goblin'),
      }),
    );
  });

  it('sends item details when inspecting an item', async () => {
    mockedDmClient.getPlayer.mockResolvedValue({
      data: {
        id: 10,
        name: 'Inspector',
        teamId: 'T1',
        userId: 'U123',
        slackUser: { teamId: 'T1', userId: 'U123' },
        x: 0,
        y: 0,
        isInHq: false,
      },
      success: true,
    } as never);

    mockedDmClient.getLocationEntities.mockResolvedValue({
      players: [],
      monsters: [],
      items: [
        {
          id: 111,
          itemId: 200,
          itemName: 'Sword',
          quality: 'Epic',
        },
      ],
    });

    mockedDmClient.getItemDetails.mockResolvedValue({
      success: true,
      data: {
        id: 200,
        name: 'Sword of Testing',
        type: 'weapon',
        attack: 5,
        defense: 0,
        healthBonus: 0,
        value: 50,
        description: 'Sharp!',
      },
    });

    const body = buildActionBody('I:111|200');
    const client = mockClient();

    await inspectHandler.handleInspectAction({
      ack: mockAck(),
      body,
      client: client as unknown as WebClient,
    });

    expect(mockedDmClient.getItemDetails).toHaveBeenCalledWith(200);
    expect(client.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'C123',
        text: expect.stringContaining('Sword of Testing'),
      }),
    );
  });

  it('blocks inspection actions while the player is in HQ', async () => {
    mockedDmClient.getPlayer.mockResolvedValue({
      success: true,
      data: {
        id: 10,
        teamId: 'T1',
        userId: 'U123',
        isInHq: true,
      },
    } as never);

    const body = buildActionBody('M:99');
    const client = mockClient();

    await inspectHandler.handleInspectAction({
      ack: mockAck(),
      body,
      client: client as unknown as WebClient,
    });

    expect(client.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: buildHqBlockedMessage(COMMANDS.INSPECT),
      }),
    );
  });
});
