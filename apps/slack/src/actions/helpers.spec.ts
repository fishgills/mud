import type { KnownBlock } from '@slack/types';
import {
  buildSayHelper,
  getActionContext,
  getActionValue,
  getChannelIdFromBody,
  getTriggerId,
  postEphemeralOrDm,
  postToUser,
} from './helpers';

type MockWebClient = {
  conversations: { open: jest.Mock };
  chat: { postMessage: jest.Mock; postEphemeral: jest.Mock };
  files: { uploadV2: jest.Mock };
};

const createMockClient = (): MockWebClient => ({
  conversations: { open: jest.fn() },
  chat: {
    postMessage: jest.fn(),
    postEphemeral: jest.fn(),
  },
  files: { uploadV2: jest.fn() },
});

describe('actions/helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getActionValue', () => {
    it('returns the first action value when it is a string', () => {
      expect(
        getActionValue({
          actions: [{ value: '42' }],
        }),
      ).toBe('42');
    });

    it('returns undefined when action value is missing or non-string', () => {
      const variants = [{ actions: [{}] }, { actions: [{ value: 99 }] }, {}];
      for (const body of variants) {
        expect(getActionValue(body)).toBeUndefined();
      }
    });
  });

  describe('trigger/channel/context extraction', () => {
    it('extracts trigger id and channel id from body variants', () => {
      expect(getTriggerId({ trigger_id: 'TRIGGER' })).toBe('TRIGGER');
      expect(getChannelIdFromBody({ channel: { id: 'C1' } })).toBe('C1');
      expect(getChannelIdFromBody({ container: { channel_id: 'C2' } })).toBe(
        'C2',
      );
    });

    it('resolves team id precedence as body.team > body.user.team_id > context', () => {
      expect(
        getActionContext(
          {
            user: { id: 'U1', team_id: 'TU' },
            team: { id: 'TB' },
            trigger_id: 'TR',
          },
          { teamId: 'TC' },
        ),
      ).toEqual({
        userId: 'U1',
        teamId: 'TB',
        triggerId: 'TR',
        channelId: undefined,
      });

      expect(
        getActionContext(
          {
            user: { id: 'U1', team_id: 'TU' },
          },
          { teamId: 'TC' },
        ).teamId,
      ).toBe('TU');

      expect(
        getActionContext(
          {
            user: { id: 'U1' },
          },
          { teamId: 'TC' },
        ).teamId,
      ).toBe('TC');
    });
  });

  describe('postToUser', () => {
    it('posts directly to a provided channel id', async () => {
      const client = createMockClient();
      await postToUser({
        client: client as never,
        channelId: 'C123',
        text: 'hello',
      });

      expect(client.conversations.open).not.toHaveBeenCalled();
      expect(client.chat.postMessage).toHaveBeenCalledWith({
        channel: 'C123',
        text: 'hello',
      });
    });

    it('opens a DM when no channel id is provided', async () => {
      const client = createMockClient();
      client.conversations.open.mockResolvedValueOnce({
        channel: { id: 'D123' },
      });

      await postToUser({
        client: client as never,
        userId: 'U123',
        text: 'hello',
      });

      expect(client.conversations.open).toHaveBeenCalledWith({ users: 'U123' });
      expect(client.chat.postMessage).toHaveBeenCalledWith({
        channel: 'D123',
        text: 'hello',
      });
    });

    it('posts blocks when provided', async () => {
      const client = createMockClient();
      const blocks = [{ type: 'section', text: { type: 'mrkdwn', text: 'x' } }];
      await postToUser({
        client: client as never,
        channelId: 'C999',
        text: 'with blocks',
        blocks: blocks as KnownBlock[],
      });
      expect(client.chat.postMessage).toHaveBeenCalledWith({
        channel: 'C999',
        text: 'with blocks',
        blocks,
      });
    });

    it('does nothing when neither userId nor channelId can be resolved', async () => {
      const client = createMockClient();
      await postToUser({
        client: client as never,
        text: 'ignored',
      });
      expect(client.chat.postMessage).not.toHaveBeenCalled();
      expect(client.conversations.open).not.toHaveBeenCalled();
    });
  });

  describe('postEphemeralOrDm', () => {
    it('posts ephemeral when channel id exists', async () => {
      const client = createMockClient();
      await postEphemeralOrDm({
        client: client as never,
        userId: 'U1',
        channelId: 'C1',
        text: 'ephemeral',
      });

      expect(client.chat.postEphemeral).toHaveBeenCalledWith({
        channel: 'C1',
        user: 'U1',
        text: 'ephemeral',
      });
      expect(client.chat.postMessage).not.toHaveBeenCalled();
    });

    it('falls back to DM when no channel id exists', async () => {
      const client = createMockClient();
      client.conversations.open.mockResolvedValueOnce({
        channel: { id: 'D1' },
      });
      await postEphemeralOrDm({
        client: client as never,
        userId: 'U1',
        text: 'dm fallback',
      });

      expect(client.chat.postEphemeral).not.toHaveBeenCalled();
      expect(client.chat.postMessage).toHaveBeenCalledWith({
        channel: 'D1',
        text: 'dm fallback',
      });
    });
  });

  describe('buildSayHelper', () => {
    it('uploads files when fileUpload is present', async () => {
      const client = createMockClient();
      const say = buildSayHelper(client as never, 'C1');

      await say({
        text: 'caption',
        fileUpload: {
          filename: 'log.txt',
          contentBase64: Buffer.from('hello').toString('base64'),
        },
      });

      expect(client.files.uploadV2).toHaveBeenCalledWith(
        expect.objectContaining({
          channel_id: 'C1',
          filename: 'log.txt',
          initial_comment: 'caption',
        }),
      );
      expect(client.chat.postMessage).not.toHaveBeenCalled();
    });

    it('posts only known blocks when blocks are provided', async () => {
      const client = createMockClient();
      const say = buildSayHelper(client as never, 'C1');

      await say({
        text: 'blocks',
        blocks: [
          { type: 'section', text: { type: 'mrkdwn', text: 'ok' } },
          { foo: 'bar' } as never,
        ],
      });

      expect(client.chat.postMessage).toHaveBeenCalledWith({
        channel: 'C1',
        text: 'blocks',
        blocks: [{ type: 'section', text: { type: 'mrkdwn', text: 'ok' } }],
      });
    });

    it('posts text or empty text fallback', async () => {
      const client = createMockClient();
      const say = buildSayHelper(client as never, 'C1');

      await say({ text: 'plain text' });
      await say({});

      expect(client.chat.postMessage).toHaveBeenNthCalledWith(1, {
        channel: 'C1',
        text: 'plain text',
      });
      expect(client.chat.postMessage).toHaveBeenNthCalledWith(2, {
        channel: 'C1',
        text: '',
      });
    });
  });
});
