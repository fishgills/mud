// Centralized command strings and Slack action IDs to avoid drift

export const COMMANDS = {
  NEW: 'new',
  HELP: 'help',
  LOOK: 'look',
  LOOK_SHORT: 'l',
  ATTACK: 'attack',
  STATS: 'stats',
  MAP: 'map',
  MOVE: 'move',
  DELETE: 'delete',
  COMPLETE: 'complete',
  REROLL: 'reroll',
  // Movement (text aliases)
  NORTH: 'north',
  SOUTH: 'south',
  EAST: 'east',
  WEST: 'west',
  UP: 'up',
  DOWN: 'down',
  LEFT: 'left',
  RIGHT: 'right',
} as const;

export type CommandKey = keyof typeof COMMANDS;

export const MOVEMENT_COMMANDS: string[] = [
  COMMANDS.NORTH,
  COMMANDS.SOUTH,
  COMMANDS.EAST,
  COMMANDS.WEST,
  COMMANDS.UP,
  COMMANDS.DOWN,
  COMMANDS.LEFT,
  COMMANDS.RIGHT,
];

export const HELP_ACTIONS = {
  CREATE: 'help_action_create',
  LOOK: 'help_action_look',
  STATS: 'help_action_stats',
  MAP: 'help_action_map',
} as const;

// Action IDs for movement quick buttons in Block Kit
export const MOVE_ACTIONS = {
  NORTH: 'move_action_north',
  SOUTH: 'move_action_south',
  EAST: 'move_action_east',
  WEST: 'move_action_west',
} as const;
