import type { App } from '@slack/bolt';
import { registerHelpActions } from './actions/helpActions';
import { registerCharacterActions } from './actions/characterActions';
import { registerHomeActions } from './actions/homeActions';
import { registerInventoryActions } from './actions/inventoryActions';
import { registerStatActions } from './actions/statActions';
import { registerCombatLogActions } from './actions/combatLogActions';
import { registerGuildShopActions } from './actions/guildShopActions';
import { registerFeedbackActions } from './actions/feedbackActions';
import { registerRunActions } from './actions/runActions';

export const registerActions = (app: App) => {
  registerHelpActions(app);
  registerCharacterActions(app);
  registerHomeActions(app);
  registerInventoryActions(app);
  registerStatActions(app);
  registerCombatLogActions(app);
  registerGuildShopActions(app);
  registerFeedbackActions(app);
  registerRunActions(app);
};
