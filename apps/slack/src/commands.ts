// Centralized command strings and Slack action IDs to avoid drift

export const COMMANDS = {
  NEW: 'new',
  HELP: 'help',
  ATTACK: 'attack',
  RUN: 'run',
  STATS: 'stats',
  GUILD: 'guild',
  BUY: 'buy',
  SELL: 'sell',
  DELETE: 'delete',
  COMPLETE: 'complete',
  REROLL: 'reroll',
  INVENTORY: 'inventory',
  EQUIP: 'equip',
  CATALOG: 'catalog',
} as const;

export type CommandKey = keyof typeof COMMANDS;

export const HELP_ACTIONS = {
  CREATE: 'help_action_create',
  STATS: 'help_action_stats',
  INVENTORY: 'help_action_inventory',
  HOW_TO_PLAY: 'help_action_how_to_play',
  COMMAND_REFERENCE: 'help_action_command_reference',
  REPORT_ISSUE: 'help_action_report_issue',
  LEVELING: 'help_action_leveling',
  COMBAT: 'help_action_combat',
  ABILITIES: 'help_action_abilities',
} as const;

export const STAT_ACTIONS = {
  OPEN_LEVEL_UP: 'stats_action_open_level_up',
} as const;

export const HOME_ACTIONS = {
  RESUME: 'home_action_resume',
  VIEW_STATS: 'home_action_view_stats',
  VIEW_LEADERBOARD: 'home_action_view_leaderboard',
  DELETE_CHARACTER: 'home_action_delete_character',
} as const;

export const CHARACTER_ACTIONS = {
  REROLL: 'character_action_reroll',
  DELETE_CONFIRM: 'character_action_delete_confirm',
} as const;

// Combat message interactions
export const COMBAT_ACTIONS = {
  SHOW_LOG: 'combat_action_show_log',
  HIDE_LOG: 'combat_action_hide_log',
} as const;

export const RUN_ACTIONS = {
  CONTINUE: 'run_action_continue',
  FINISH: 'run_action_finish',
} as const;

export const GUILD_SHOP_ACTIONS = {
  BUY: 'guild_shop_action_buy',
  SELL: 'guild_shop_action_sell',
} as const;

export const FEEDBACK_ACTIONS = {
  OPEN_MODAL: 'feedback_open_modal',
  DELETE: 'feedback_delete',
} as const;
