jest.mock('../clients/dm-sdk', () => {
  const dmSdk = {
    SniffNearestMonster: jest.fn(),
  };
  return { dmSdk };
});

jest.mock('./errorUtils', () => ({
  getUserFriendlyErrorMessage: jest.fn(),
}));

import { dmSdk } from '../clients/dm-sdk';
import { COMMANDS } from '../commands';
import { toClientId } from '../utils/clientId';
import { sniffHandler } from './sniff';
import type { HandlerContext } from './types';
import { getUserFriendlyErrorMessage } from './errorUtils';

const mockedSniff = dmSdk.SniffNearestMonster as jest.MockedFunction<
  typeof dmSdk.SniffNearestMonster
>;
const mockedGetUserFriendlyErrorMessage =
  getUserFriendlyErrorMessage as jest.MockedFunction<
    typeof getUserFriendlyErrorMessage
  >;

describe('sniffHandler', () => {
  const makeContext = (userId = 'U123'): HandlerContext => ({
    userId,
    text: COMMANDS.SNIFF,
    say: jest.fn(async () => undefined),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reports the detected monster with formatted distance and direction', async () => {
    const ctx = makeContext();
    mockedSniff.mockResolvedValueOnce({
      sniffNearestMonster: {
        success: true,
        data: {
          monsterName: 'Goblin',
          distance: 3.44,
          direction: 'to the north',
        },
      },
    });

    await sniffHandler(ctx);

    expect(mockedSniff).toHaveBeenCalledWith({ slackId: toClientId('U123') });
    expect(ctx.say).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('Goblin about 3.4 tiles to the north'),
      }),
    );
  });

  it('handles no monster detected case with detection radius', async () => {
    const ctx = makeContext('U999');
    mockedSniff.mockResolvedValueOnce({
      sniffNearestMonster: {
        success: true,
        message: 'No monsters in range',
        data: {
          detectionRadius: 2,
        },
      },
    });

    await sniffHandler(ctx);

    expect(ctx.say).toHaveBeenCalledWith({ text: 'No monsters in range' });
  });

  it('handles failed sniff attempt', async () => {
    const ctx = makeContext();
    mockedSniff.mockResolvedValueOnce({
      sniffNearestMonster: {
        success: false,
        message: 'Something went wrong',
      },
    });

    await sniffHandler(ctx);

    expect(ctx.say).toHaveBeenCalledWith({ text: 'Something went wrong' });
  });

  it('uses user friendly error message when sniffing throws', async () => {
    const ctx = makeContext();
    const error = new Error('network fail');
    mockedSniff.mockRejectedValueOnce(error);
    mockedGetUserFriendlyErrorMessage.mockReturnValueOnce('friendly message');

    await sniffHandler(ctx);

    expect(mockedGetUserFriendlyErrorMessage).toHaveBeenCalledWith(
      error,
      'Failed to sniff for monsters',
    );
    expect(ctx.say).toHaveBeenCalledWith({ text: 'friendly message' });
  });
});
