import { buildBattleforgeRecipients } from './battleforge-channel.recipients';
import { getPrismaClient } from '@mud/database';

jest.mock('@mud/database', () => ({
  getPrismaClient: jest.fn(),
}));

describe('buildBattleforgeRecipients', () => {
  let prismaMock: { workspace: { findMany: jest.Mock } };

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock = { workspace: { findMany: jest.fn() } };
    (getPrismaClient as jest.Mock).mockReturnValue(prismaMock);
  });

  it('returns one slack-channel recipient per workspace that has a channel configured', async () => {
    prismaMock.workspace.findMany.mockResolvedValue([
      { workspaceId: 'T1', battleforgeChannelId: 'C1' },
      { workspaceId: 'T2', battleforgeChannelId: 'C2' },
    ]);

    const recipients = await buildBattleforgeRecipients('hello');

    expect(recipients).toHaveLength(2);
    expect(recipients[0]).toEqual({
      clientType: 'slack-channel',
      teamId: 'T1',
      channelId: 'C1',
      message: 'hello',
      blocks: undefined,
      priority: 'low',
    });
    expect(recipients[1]).toEqual({
      clientType: 'slack-channel',
      teamId: 'T2',
      channelId: 'C2',
      message: 'hello',
      blocks: undefined,
      priority: 'low',
    });
  });

  it('passes blocks through to each recipient when provided', async () => {
    prismaMock.workspace.findMany.mockResolvedValue([
      { workspaceId: 'T1', battleforgeChannelId: 'C1' },
    ]);
    const blocks = [
      { type: 'section', text: { type: 'mrkdwn', text: 'a block' } },
    ];

    const recipients = await buildBattleforgeRecipients(
      'msg with blocks',
      blocks,
    );

    expect(recipients).toHaveLength(1);
    expect(recipients[0]).toMatchObject({
      clientType: 'slack-channel',
      message: 'msg with blocks',
      blocks,
    });
  });

  it('queries only uninstalled=null workspaces with a non-null battleforgeChannelId', async () => {
    prismaMock.workspace.findMany.mockResolvedValue([]);

    await buildBattleforgeRecipients('test');

    expect(prismaMock.workspace.findMany).toHaveBeenCalledWith({
      where: { battleforgeChannelId: { not: null }, uninstalledAt: null },
      select: { workspaceId: true, battleforgeChannelId: true },
    });
  });

  it('returns an empty array when no workspaces are configured', async () => {
    prismaMock.workspace.findMany.mockResolvedValue([]);

    const recipients = await buildBattleforgeRecipients('nothing');

    expect(recipients).toEqual([]);
  });
});
