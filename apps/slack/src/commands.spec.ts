import { COMMANDS } from './commands';

describe('commands constants', () => {
  it('exposes unique command values', () => {
    const commandValues = Object.values(COMMANDS);
    expect(new Set(commandValues).size).toBe(commandValues.length);
  });

  it('includes the core command set', () => {
    const commandValues = Object.values(COMMANDS);
    expect(commandValues).toEqual(
      expect.arrayContaining([
        COMMANDS.NEW,
        COMMANDS.ATTACK,
        COMMANDS.STATS,
        COMMANDS.INVENTORY,
        COMMANDS.CATALOG,
        COMMANDS.BUY,
        COMMANDS.SELL,
      ]),
    );
  });
});
