import type { App, BlockAction, ViewSubmitAction } from '@slack/bolt';
import { COMMANDS, HELP_ACTIONS } from '../commands';
import { buildSayHelper } from './helpers';
import { getAllHandlers } from '../handlers/handlerRegistry';

export const registerCharacterActions = (app: App) => {
  app.action<BlockAction>(
    HELP_ACTIONS.CREATE,
    async ({ ack, body, client }) => {
      await ack();
      const triggerId = body.trigger_id;
      try {
        await client.views.open({
          trigger_id: triggerId,
          view: {
            type: 'modal',
            callback_id: 'create_character_view',
            title: { type: 'plain_text', text: 'Create Character' },
            submit: { type: 'plain_text', text: 'Create' },
            close: { type: 'plain_text', text: 'Cancel' },
            blocks: [
              {
                type: 'input',
                block_id: 'create_name_block',
                label: { type: 'plain_text', text: 'Character name' },
                element: {
                  type: 'plain_text_input',
                  action_id: 'character_name',
                  placeholder: {
                    type: 'plain_text',
                    text: 'e.g., AwesomeDude',
                  },
                },
              },
            ],
          },
        });
      } catch {
        const userId = body.user?.id;
        if (!userId) return;
        const dm = await client.conversations.open({ users: userId });
        const channel = dm.channel?.id;
        if (!channel) return;
        await client.chat.postMessage({
          channel,
          text: 'To create a character, type: `new YourName`',
        });
      }
    },
  );

  app.view<ViewSubmitAction>(
    'create_character_view',
    async ({ ack, body, client, context }) => {
      const values = body.view.state?.values;
      const name = values?.create_name_block?.character_name?.value?.trim();

      if (!name) {
        await ack({
          response_action: 'errors',
          errors: { create_name_block: 'Please enter a character name.' },
        });
        return;
      }

      await ack();

      const userId = body.user?.id;
      const teamId =
        typeof context.teamId === 'string' ? context.teamId : undefined;
      if (!userId) return;
      const handler = getAllHandlers()[COMMANDS.NEW];
      if (!handler) return;
      const dm = await client.conversations.open({ users: userId });
      const channel = dm.channel?.id;
      if (!channel) return;
      const say = buildSayHelper(client, channel);
      await handler({
        userId,
        text: `${COMMANDS.NEW} ${name}`,
        say,
        teamId: teamId!,
      });
    },
  );
};
