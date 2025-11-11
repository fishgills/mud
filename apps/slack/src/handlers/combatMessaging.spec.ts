import type { WebClient } from '@slack/web-api';
import { deliverCombatMessages } from './combatMessaging';
import type { CombatResult } from '../dm-client';

const createClient = () => {
  const conversations = {
    open: jest.fn<
      Promise<{ channel?: { id?: string | null }; ok?: boolean }>,
      [{ users: string }]
    >(),
  };
  const chat = {
    postMessage: jest.fn<Promise<void>, [Record<string, unknown>]>(),
  };
  return { conversations, chat } as unknown as WebClient & {
    conversations: { open: jest.Mock };
    chat: { postMessage: jest.Mock };
  };
};

const buildMessage = (
  overrides: Partial<NonNullable<CombatResult['playerMessages']>[number]> = {},
) => ({
  userId: 'U1',
  teamId: 'T1',
  message: 'Fight!',
  blocks: [{ type: 'section', text: { type: 'mrkdwn', text: 'Fight!' } }],
  ...overrides,
});

describe('deliverCombatMessages', () => {
  it('opens one DM per unique player and posts combat summaries', async () => {
    const client = createClient();
    client.conversations.open.mockResolvedValue({
      ok: true,
      channel: { id: 'DCHAN' },
    });

    await deliverCombatMessages(client, [
      buildMessage({ userId: 'U1', teamId: 'T1' }),
      buildMessage({ userId: 'U1', teamId: 'T1', message: 'Duplicate' }),
      buildMessage({ userId: 'U2', teamId: 'T1', message: 'Second player' }),
    ]);

    expect(client.conversations.open).toHaveBeenCalledTimes(2);
    expect(client.conversations.open).toHaveBeenCalledWith({ users: 'U1' });
    expect(client.conversations.open).toHaveBeenCalledWith({ users: 'U2' });
    expect(client.chat.postMessage).toHaveBeenCalledTimes(2);
    expect(client.chat.postMessage).toHaveBeenCalledWith({
      channel: 'DCHAN',
      text: 'Fight!',
      blocks: expect.any(Array),
    });
  });

  it('skips entries without user ids or missing channels', async () => {
    const client = createClient();
    client.conversations.open.mockResolvedValueOnce({ ok: true });
    client.conversations.open.mockResolvedValueOnce({
      ok: true,
      channel: { id: 'D2' },
    });

    await deliverCombatMessages(client, [
      buildMessage({ userId: undefined }),
      buildMessage({ userId: 'U2' }),
      buildMessage({ userId: 'U3' }),
    ]);

    expect(client.chat.postMessage).toHaveBeenCalledTimes(1);
    expect(client.chat.postMessage).toHaveBeenCalledWith({
      channel: 'D2',
      text: 'Fight!',
      blocks: expect.any(Array),
    });
  });

  it('returns immediately when no slack client is provided', async () => {
    await expect(
      deliverCombatMessages(undefined, [buildMessage()]),
    ).resolves.toBeUndefined();
  });
});
