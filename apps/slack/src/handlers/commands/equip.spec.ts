jest.mock('../../dm-client', () => ({
  equip: jest.fn(),
}));

jest.mock('../handlerRegistry', () => ({
  registerHandler: jest.fn(),
}));

import { equip } from '../../dm-client';
import { equipHandler } from './equip';
import { COMMANDS } from '../../commands';
import type { HandlerContext } from '../types';

const mockedEquip = equip as jest.MockedFunction<typeof equip>;

const createSay = () =>
  jest.fn<Promise<void>, [{ text: string }]>().mockResolvedValue(undefined);

describe('equipHandler', () => {
  const baseContext: HandlerContext = {
    userId: 'U1',
    teamId: 'T1',
    say: createSay(),
    text: COMMANDS.EQUIP,
  } as HandlerContext;

  beforeEach(() => {
    jest.clearAllMocks();
    baseContext.say = createSay();
  });

  it('requires both a player item id and a slot', async () => {
    await equipHandler(baseContext);
    expect(baseContext.say).toHaveBeenCalledWith({
      text: `Usage: ${COMMANDS.EQUIP} <playerItemId> <slot>`,
    });
  });

  it('validates numeric identifiers for equip', async () => {
    await equipHandler({
      ...baseContext,
      text: `${COMMANDS.EQUIP} nope head`,
    });
    expect(baseContext.say).toHaveBeenCalledWith({
      text: 'Invalid playerItemId: nope',
    });
  });

  it('calls dmClient.equip and reports success', async () => {
    mockedEquip.mockResolvedValueOnce({
      success: true,
      data: { item: { name: 'Shortsword' }, quality: 'Common' },
    });
    await equipHandler({
      ...baseContext,
      text: `${COMMANDS.EQUIP} 15 head`,
    });
    expect(mockedEquip).toHaveBeenCalledWith({
      teamId: 'T1',
      userId: 'U1',
      playerItemId: 15,
      slot: 'head',
    });
    expect(baseContext.say).toHaveBeenCalledWith({
      text: 'Equipped Common Shortsword to head.',
    });
  });

  it('shows backend error messages on failure', async () => {
    mockedEquip.mockResolvedValueOnce({
      success: false,
      message: 'Nope',
    });
    await equipHandler({
      ...baseContext,
      text: `${COMMANDS.EQUIP} 15 head`,
    });
    expect(baseContext.say).toHaveBeenCalledWith({ text: 'Nope' });
  });

  it('handles thrown errors gracefully', async () => {
    mockedEquip.mockRejectedValueOnce(new Error('bad equip'));
    await equipHandler({
      ...baseContext,
      text: `${COMMANDS.EQUIP} 15 head`,
    });
    expect(baseContext.say).toHaveBeenCalledWith({
      text: expect.stringContaining('bad equip'),
    });
  });
});
