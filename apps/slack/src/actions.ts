import type { App } from '@slack/bolt';
import { registerHelpActions } from './actions/helpActions';
import { registerCharacterActions } from './actions/characterActions';
import { registerHomeActions } from './actions/homeActions';
import { registerMovementActions } from './actions/movementActions';
import { registerInventoryActions } from './actions/inventoryActions';
import { registerAttackActions } from './actions/attackActions';
import { registerPickupActions } from './actions/pickupActions';
import { registerStatActions } from './actions/statActions';
import { registerCombatLogActions } from './actions/combatLogActions';
import { registerInspectActions } from './actions/inspectActions';
import { registerGuildShopActions } from './actions/guildShopActions';

export const registerActions = (app: App) => {
  registerHelpActions(app);
  registerCharacterActions(app);
  registerHomeActions(app);
  registerMovementActions(app);
  registerInventoryActions(app);
  registerAttackActions(app);
  registerPickupActions(app);
  registerStatActions(app);
  registerCombatLogActions(app);
  registerInspectActions(app);
  registerGuildShopActions(app);
};
