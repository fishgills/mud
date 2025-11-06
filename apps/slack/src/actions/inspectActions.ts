import type { App, BlockAction } from '@slack/bolt';
import { INSPECT_ACTIONS } from '../commands';
import { inspectHandler } from '../handlers/inspect';

export const registerInspectActions = (app: App) => {
  app.action<BlockAction>(INSPECT_ACTIONS.TARGET_SELECT, async ({ ack }) => {
    await ack();
  });

  app.action<BlockAction>(
    INSPECT_ACTIONS.INSPECT_TARGET,
    async ({ ack, body, client }) => {
      await inspectHandler.handleInspectAction({ ack, body, client });
    },
  );
};
