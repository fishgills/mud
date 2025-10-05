import type { App, BlockAction, ViewSubmitAction } from '@slack/bolt';
import type { Block, KnownBlock } from '@slack/types';
import type { WebClient } from '@slack/web-api';
import {
  COMMANDS,
  HELP_ACTIONS,
  MOVE_ACTIONS,
  ATTACK_ACTIONS,
  STAT_ACTIONS,
} from './commands';
import { dmSdk } from './gql-client';
import { PlayerAttribute, TargetType } from './generated/dm-graphql';
import { buildCombatSummary } from './handlers/attack';
import { getUserFriendlyErrorMessage } from './handlers/errorUtils';
import { getAllHandlers } from './handlers/handlerRegistry';
import { buildPlayerStatsMessage } from './handlers/stats/format';
import type { HandlerContext, SayMessage } from './handlers/types';
import type { ViewStateValue } from '@slack/bolt';
import { toClientId } from './utils/clientId';

type SlackBlockState = Record<string, Record<string, ViewStateValue>>;

const isKnownBlockArray = (
  blocks: (KnownBlock | Block)[],
): blocks is KnownBlock[] => blocks.every((block) => 'type' in block);

const buildSayHelper =
  (client: WebClient, channel: string): HandlerContext['say'] =>
  async (msg: SayMessage) => {
    if (msg.fileUpload && client.files?.uploadV2) {
      const buffer = Buffer.from(msg.fileUpload.contentBase64, 'base64');
      await client.files.uploadV2({
        channel_id: channel,
        filename: msg.fileUpload.filename,
        file: buffer,
        initial_comment: msg.text ?? undefined,
      });
      return;
    }

    if (msg.blocks && msg.blocks.length > 0) {
      const blocks = isKnownBlockArray(msg.blocks)
        ? msg.blocks
        : msg.blocks.filter((block): block is KnownBlock => 'type' in block);
      await client.chat.postMessage({
        channel,
        text: msg.text ?? '',
        blocks,
      });
      return;
    }

    if (msg.text) {
      await client.chat.postMessage({ channel, text: msg.text });
      return;
    }

    await client.chat.postMessage({ channel, text: '' });
  };

type SelectedTarget =
  | { kind: 'monster'; id: number; name: string }
  | { kind: 'player'; slackId: string; name: string };

function extractSelectedTarget(values: SlackBlockState | undefined): SelectedTarget | null {
  if (!values) {
    return null;
  }

  for (const block of Object.values(values)) {
    const selection = block[ATTACK_ACTIONS.MONSTER_SELECT];
    const option = selection?.selected_option;
    if (!option?.value) {
      continue;
    }

    const raw = option.value as string;
    const text = option.text?.text?.trim() || '';

    if (raw.startsWith('M:')) {
      const idPart = raw.slice(2);
      const idNum = Number(idPart);
      if (!Number.isNaN(idNum)) {
        return { kind: 'monster', id: idNum, name: text.replace(/^Monster:\s*/i, '') || 'the monster' };
      }
    }
    if (raw.startsWith('P:')) {
      const slackId = raw.slice(2);
      if (slackId) {
        return { kind: 'player', slackId, name: text.replace(/^Player:\s*/i, '') || 'the player' };
      }
    }
  }

  return null;
}

// Helper to run an existing text command handler from a button click
async function dispatchCommandViaDM(
  client: WebClient,
  userId: string,
  command: string,
) {
  const handler = getAllHandlers()[command];
  if (!handler) return;
  const dm = await client.conversations.open({ users: userId });
  const channel = dm.channel?.id;
  if (!channel) return;
  const say = buildSayHelper(client, channel);
  await handler({ userId, text: command, say });
}

export function registerActions(app: App) {
  // Help quick actions
  app.action<BlockAction>(HELP_ACTIONS.LOOK, async ({ ack, body, client }) => {
    await ack();
    const userId = body.user?.id;
    if (!userId) return;
    await dispatchCommandViaDM(client, userId, COMMANDS.LOOK);
  });

  app.action<BlockAction>(HELP_ACTIONS.STATS, async ({ ack, body, client }) => {
    await ack();
    const userId = body.user?.id;
    if (!userId) return;
    await dispatchCommandViaDM(client, userId, COMMANDS.STATS);
  });

  app.action<BlockAction>(HELP_ACTIONS.MAP, async ({ ack, body, client }) => {
    await ack();
    const userId = body.user?.id;
    if (!userId) return;
    await dispatchCommandViaDM(client, userId, COMMANDS.MAP);
  });

  // Create button: open a modal to capture character name
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
        // Fallback: DM prompt if opening modal fails (e.g., missing views:write scope)
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

  // Handle the Create Character modal submission
  app.view<ViewSubmitAction>(
    'create_character_view',
    async ({ ack, body, client }) => {
      const values = body.view.state.values;
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
      if (!userId) return;
      const handler = getAllHandlers()[COMMANDS.NEW];
      if (!handler) return;
      const dm = await client.conversations.open({ users: userId });
      const channel = dm.channel?.id;
      if (!channel) return;
      const say = buildSayHelper(client, channel);
      // Invoke existing create flow with text command shape
      await handler({ userId, text: `${COMMANDS.NEW} ${name}`, say });
    },
  );

  // Movement quick buttons
  app.action<BlockAction>(MOVE_ACTIONS.NORTH, async ({ ack, body, client }) => {
    await ack();
    const userId = body.user?.id;
    if (!userId) return;
    await dispatchCommandViaDM(client, userId, COMMANDS.NORTH);
  });

  app.action<BlockAction>(MOVE_ACTIONS.SOUTH, async ({ ack, body, client }) => {
    await ack();
    const userId = body.user?.id;
    if (!userId) return;
    await dispatchCommandViaDM(client, userId, COMMANDS.SOUTH);
  });

  app.action<BlockAction>(MOVE_ACTIONS.WEST, async ({ ack, body, client }) => {
    await ack();
    const userId = body.user?.id;
    if (!userId) return;
    await dispatchCommandViaDM(client, userId, COMMANDS.WEST);
  });

  app.action<BlockAction>(MOVE_ACTIONS.EAST, async ({ ack, body, client }) => {
    await ack();
    const userId = body.user?.id;
    if (!userId) return;
    await dispatchCommandViaDM(client, userId, COMMANDS.EAST);
  });

  app.action(ATTACK_ACTIONS.MONSTER_SELECT, async ({ ack }) => {
    await ack();
  });

  app.action<BlockAction>(
    ATTACK_ACTIONS.ATTACK_MONSTER,
    async ({ ack, body, client }) => {
      await ack();

      const userId = body.user?.id;
      const channelId =
        body.channel?.id ||
        (typeof body.container?.channel_id === 'string'
          ? body.container.channel_id
          : undefined);

      if (!userId || !channelId) {
        return;
      }

      const selected = extractSelectedTarget(body.state?.values as SlackBlockState | undefined);

      if (!selected) {
        await client.chat.postMessage({
          channel: channelId,
          text: 'Please select a monster to attack first!',
        });
        return;
      }

      try {
        const isMonster = selected.kind === 'monster';
        const attackResult = await dmSdk.Attack({
          slackId: toClientId(userId),
          input: isMonster
            ? {
                targetType: TargetType.Monster,
                targetId: selected.id,
              }
            : {
                targetType: TargetType.Player,
                targetSlackId: selected.slackId,
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
    },
  );

  const skillActionMap: Record<string, PlayerAttribute> = {
    [STAT_ACTIONS.INCREASE_STRENGTH]: PlayerAttribute.Strength,
    [STAT_ACTIONS.INCREASE_AGILITY]: PlayerAttribute.Agility,
    [STAT_ACTIONS.INCREASE_HEALTH]: PlayerAttribute.Health,
  };

  for (const [actionId, attribute] of Object.entries(skillActionMap)) {
    app.action<BlockAction>(
      actionId,
      async ({ ack, body, client, respond }) => {
        await ack();

        const userId = body.user?.id;
        const channelId =
          body.channel?.id ||
          (typeof body.container?.channel_id === 'string'
            ? body.container.channel_id
            : undefined);
        const messageTs =
          (typeof body.message?.ts === 'string'
            ? body.message.ts
            : undefined) ||
          (typeof body.container?.message_ts === 'string'
            ? body.container.message_ts
            : undefined);

        if (!userId) {
          return;
        }

        try {
          const result = await dmSdk.SpendSkillPoint({
            slackId: toClientId(userId),
            attribute,
          });
          if (!result.spendSkillPoint.success || !result.spendSkillPoint.data) {
            const errorText =
              result.spendSkillPoint.message ??
              'Unable to spend a skill point right now.';
            if (respond) {
              await respond({
                text: errorText,
                response_type: 'ephemeral',
                replace_original: false,
              });
            }
            return;
          }

          if (channelId && messageTs) {
            const statsMessage = buildPlayerStatsMessage(
              result.spendSkillPoint.data,
              {
                isSelf: true,
              },
            );
            await client.chat.update({
              channel: channelId,
              ts: messageTs,
              text: statsMessage.text,
              blocks: statsMessage.blocks.filter(
                (block): block is KnownBlock => 'type' in block,
              ),
            });
          }
        } catch (err) {
          const errorMessage = getUserFriendlyErrorMessage(
            err,
            'Failed to spend a skill point',
          );
          if (respond) {
            await respond({
              text: errorMessage,
              response_type: 'ephemeral',
              replace_original: false,
            });
          }
        }
      },
    );
  }
}
