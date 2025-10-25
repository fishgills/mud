import { COMMANDS, MOVEMENT_COMMANDS } from './commands';

describe('commands constants', () => {
  it('should expose each movement command exactly once', () => {
    const uniqueCommands = new Set(MOVEMENT_COMMANDS);

    expect(uniqueCommands.size).toBe(MOVEMENT_COMMANDS.length);
    expect(uniqueCommands).toEqual(
      new Set([
        COMMANDS.NORTH,
        COMMANDS.SOUTH,
        COMMANDS.EAST,
        COMMANDS.WEST,
        COMMANDS.UP,
        COMMANDS.DOWN,
        COMMANDS.LEFT,
        COMMANDS.RIGHT,
      ]),
    );
  });

  it('should ensure movement commands are part of the command catalogue', () => {
    const commandValues = Object.values(COMMANDS);
    for (const movement of MOVEMENT_COMMANDS) {
      expect(commandValues).toContain(movement);
    }
  });
});
