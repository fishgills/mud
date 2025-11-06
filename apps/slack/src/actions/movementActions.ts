import type { App, BlockAction } from '@slack/bolt';
import { COMMANDS, MOVE_ACTIONS } from '../commands';
import { dispatchCommandViaDM } from './commandDispatch';

const registerMovementAction = (
  app: App,
  actionId: string,
  command: string,
) => {
  app.action<BlockAction>(actionId, async ({ ack, body, client, context }) => {
    await ack();
    const userId = body.user?.id;
    const teamId =
      typeof context.teamId === 'string' ? context.teamId : undefined;
    if (!userId) return;
    await dispatchCommandViaDM(client, userId, command, teamId);
  });
};

export const registerMovementActions = (app: App) => {
  registerMovementAction(app, MOVE_ACTIONS.NORTH, COMMANDS.NORTH);
  registerMovementAction(app, MOVE_ACTIONS.SOUTH, COMMANDS.SOUTH);
  registerMovementAction(app, MOVE_ACTIONS.WEST, COMMANDS.WEST);
  registerMovementAction(app, MOVE_ACTIONS.EAST, COMMANDS.EAST);
};
