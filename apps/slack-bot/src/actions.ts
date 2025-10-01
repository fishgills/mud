import type { App } from '@slack/bolt';
import { COMMANDS, HELP_ACTIONS, MOVE_ACTIONS, ATTACK_ACTIONS } from './commands';
import { dmSdk } from './gql-client';
import { TargetType } from './generated/dm-graphql';
import { buildCombatSummary } from './handlers/attack';
import { getUserFriendlyErrorMessage } from './handlers/errorUtils';
import { getAllHandlers } from './handlers/handlerRegistry';

type SlackBlockState = Record<
  string,
  Record<
    string,
    {
      selected_option?: {
        value?: string | null;
        text?: { text?: string | null };
      };
    }
  >
>;

function extractSelectedMonster(values: SlackBlockState | undefined) {
  if (!values) {
    return null;
  }

  for (const block of Object.values(values)) {
    const selection = block[ATTACK_ACTIONS.MONSTER_SELECT];
    const option = selection?.selected_option;
    if (!option?.value) {
      continue;
    }

    const monsterId = Number(option.value);
    if (Number.isNaN(monsterId)) {
      continue;
    }

    const name = option.text?.text?.trim() || 'the monster';
    return { id: monsterId, name };
  }

  return null;
}

// Helper to run an existing text command handler from a button click
async function dispatchCommandViaDM(
  client: any,
  userId: string,
  command: string,
) {
  const handler = getAllHandlers()[command];
  if (!handler) return;
  const dm = await client.conversations.open({ users: userId });
  const channel = dm.channel?.id as string;
  if (!channel) return;
  const say = (msg: { text?: string; blocks?: any[] }) =>
    client.chat.postMessage({ channel, ...(msg as any) } as any) as any;
  await handler({ userId, text: command, say });
}

export function registerActions(app: App) {
  // Help quick actions
  app.action(HELP_ACTIONS.LOOK, async ({ ack, body, client }) => {
    await ack();
    const userId = (body as any).user?.id as string;
    if (!userId) return;
    await dispatchCommandViaDM(client, userId, COMMANDS.LOOK);
  });

  app.action(HELP_ACTIONS.STATS, async ({ ack, body, client }) => {
    await ack();
    const userId = (body as any).user?.id as string;
    if (!userId) return;
    await dispatchCommandViaDM(client, userId, COMMANDS.STATS);
  });

  app.action(HELP_ACTIONS.MAP, async ({ ack, body, client }) => {
    await ack();
    const userId = (body as any).user?.id as string;
    if (!userId) return;
    await dispatchCommandViaDM(client, userId, COMMANDS.MAP);
  });

  // Create button: open a modal to capture character name
  app.action(HELP_ACTIONS.CREATE, async ({ ack, body, client }) => {
    await ack();
    const trigger_id = (body as any).trigger_id as string;
    try {
      await client.views.open({
        trigger_id,
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
                placeholder: { type: 'plain_text', text: 'e.g., AwesomeDude' },
              },
            },
          ],
        },
      });
    } catch (e) {
      // Fallback: DM prompt if opening modal fails (e.g., missing views:write scope)
      const userId = (body as any).user?.id as string;
      if (!userId) return;
      const dm = await client.conversations.open({ users: userId });
      const channel = dm.channel?.id as string;
      if (!channel) return;
      await client.chat.postMessage({
        channel,
        text: 'To create a character, type: `new YourName`',
      });
    }
  });

  // Handle the Create Character modal submission
  app.view('create_character_view', async ({ ack, body, client }) => {
    const values = (body as any).view?.state?.values as any;
    const name = values?.create_name_block?.character_name?.value?.trim();

    if (!name) {
      await ack({
        response_action: 'errors',
        errors: { create_name_block: 'Please enter a character name.' },
      } as any);
      return;
    }

    await ack();

    const userId = (body as any).user?.id as string;
    if (!userId) return;
    const handler = getAllHandlers()[COMMANDS.NEW];
    if (!handler) return;
    const dm = await client.conversations.open({ users: userId });
    const channel = dm.channel?.id as string;
    if (!channel) return;
    const say = (msg: { text?: string; blocks?: any[] }) =>
      client.chat.postMessage({ channel, ...(msg as any) } as any) as any;
    // Invoke existing create flow with text command shape
    await handler({ userId, text: `${COMMANDS.NEW} ${name}`, say });
  });

  // Movement quick buttons
  app.action(MOVE_ACTIONS.NORTH, async ({ ack, body, client }) => {
    await ack();
    const userId = (body as any).user?.id as string;
    if (!userId) return;
    await dispatchCommandViaDM(client, userId, COMMANDS.NORTH);
  });

  app.action(MOVE_ACTIONS.SOUTH, async ({ ack, body, client }) => {
    await ack();
    const userId = (body as any).user?.id as string;
    if (!userId) return;
    await dispatchCommandViaDM(client, userId, COMMANDS.SOUTH);
  });

  app.action(MOVE_ACTIONS.WEST, async ({ ack, body, client }) => {
    await ack();
    const userId = (body as any).user?.id as string;
    if (!userId) return;
    await dispatchCommandViaDM(client, userId, COMMANDS.WEST);
  });

  app.action(MOVE_ACTIONS.EAST, async ({ ack, body, client }) => {
    await ack();
    const userId = (body as any).user?.id as string;
    if (!userId) return;
    await dispatchCommandViaDM(client, userId, COMMANDS.EAST);
  });

  app.action(ATTACK_ACTIONS.MONSTER_SELECT, async ({ ack }) => {
    await ack();
  });

  app.action(ATTACK_ACTIONS.ATTACK_MONSTER, async ({ ack, body, client }) => {
    await ack();

    const userId = (body as any).user?.id as string | undefined;
    const channelId =
      ((body as any).channel?.id as string | undefined) ||
      ((body as any).container?.channel_id as string | undefined);

    if (!userId || !channelId) {
      return;
    }

    const selected = extractSelectedMonster((body as any).state?.values);

    if (!selected) {
      await client.chat.postMessage({
        channel: channelId,
        text: 'Please select a monster to attack first!',
      });
      return;
    }

    try {
      const attackResult = await dmSdk.Attack({
        slackId: userId,
        input: {
          targetType: TargetType.Monster,
          targetId: selected.id,
        },
      });

      if (!attackResult.attack.success) {
        await client.chat.postMessage({
          channel: channelId,
          text: `Attack failed: ${attackResult.attack.message}`,
        });
        return;
      }

      const combat = attackResult.attack.data;
      if (!combat) {
        await client.chat.postMessage({
          channel: channelId,
          text: 'Attack succeeded but no combat data returned.',
        });
        return;
      }

      const message = buildCombatSummary(combat, selected.name);
      await client.chat.postMessage({ channel: channelId, text: message });
    } catch (err) {
      const message = getUserFriendlyErrorMessage(err, 'Failed to attack');
      await client.chat.postMessage({ channel: channelId, text: message });
    }
  });
}
