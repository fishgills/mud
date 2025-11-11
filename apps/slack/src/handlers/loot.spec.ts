jest.mock('./handlerRegistry', () => ({
  registerHandler: jest.fn(),
}));

describe('lootHandler', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  const importHandler = async () => {
    const { registerHandler } = await import('./handlerRegistry');
    await import('./loot');
    return (registerHandler as jest.Mock).mock.calls[0][1];
  };

  it('generates a loot preview and rarity summary', async () => {
    const handler = await importHandler();
    const say = jest.fn().mockResolvedValue(undefined);
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.01);

    await handler({
      say,
      text: 'loot 5',
      userId: 'U1',
      teamId: 'T1',
    } as any);

    expect(randomSpy).toHaveBeenCalled();
    expect(say).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('Loot preview for level 5'),
      }),
    );
  });
});
