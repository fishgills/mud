import type { App, BlockAction, ViewSubmitAction } from '@slack/bolt';
import type {
  Block,
  KnownBlock,
  SectionBlock,
  DividerBlock,
  ActionsBlock,
  Button,
} from '@slack/types';
import type { WebClient } from '@slack/web-api';
import {
  COMMANDS,
  HELP_ACTIONS,
  MOVE_ACTIONS,
  ATTACK_ACTIONS,
  STAT_ACTIONS,
  COMBAT_ACTIONS,
} from './commands';
import { dmClient } from './dm-client';
import { PlayerAttribute, TargetType } from './dm-types';
import { getUserFriendlyErrorMessage } from './handlers/errorUtils';
import {
  MONSTER_SELECTION_BLOCK_ID,
  SELF_ATTACK_ERROR,
} from './handlers/attack';
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

function extractSelectedTarget(
  values: SlackBlockState | undefined,
): SelectedTarget | null {
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
        return {
          kind: 'monster',
          id: idNum,
          name: text.replace(/^Monster:\s*/i, '') || 'the monster',
        };
      }
    }
    if (raw.startsWith('P:')) {
      const slackId = raw.slice(2);
      if (slackId) {
        return {
          kind: 'player',
          slackId,
          name: text.replace(/^Player:\s*/i, '') || 'the player',
        };
      }
    }
  }

  return null;
}

function buildBlocksWithAttackInProgress(
  blocks: KnownBlock[] | undefined,
  progressText: string,
): KnownBlock[] | null {
  if (!blocks) {
    return null;
  }

  let changed = false;
  const updatedBlocks: KnownBlock[] = [];

  for (const block of blocks) {
    if (
      block.type === 'actions' &&
      block.block_id === MONSTER_SELECTION_BLOCK_ID
    ) {
      changed = true;
      updatedBlocks.push({
        type: 'section',
        block_id: MONSTER_SELECTION_BLOCK_ID,
        text: {
          type: 'mrkdwn',
          text: progressText,
        },
      });
      continue;
    }

    updatedBlocks.push(block);
  }

  return changed ? updatedBlocks : null;
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

type HelpDetailMessage = {
  text: string;
  blocks: KnownBlock[];
};

const helpDetailMessages = {
  [HELP_ACTIONS.LEVELING]: {
    text: 'Leveling & Progression',
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: 'Leveling & Progression',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Earn XP*\n• Defeat monsters, clear quests, and discover new rooms to gain experience.\n• Track your current XP and next level in `stats`.',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Leveling Up*\n• Each level awards attribute points to spend on Strength, Agility, or Vitality from the `stats` menu.\n• Higher levels unlock new gear tiers and ability slots at key milestones.',
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: 'Tip: Partying up shares XP, and exploring new tiles gives a small bonus once per room.',
          },
        ],
      },
    ],
  },
  [HELP_ACTIONS.COMBAT]: {
    text: 'Combat Primer',
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: 'Combat Primer', emoji: true },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Turn Order*\n• Battles are turn-based: the highest Agility acts first each round.\n• Moving before a fight sets your range and who you can reach.',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Actions*\n• Use `attack` to strike with your weapon, or trigger abilities that appear in combat prompts.\n• Watch the combat log for status effects, cooldowns, and enemy intents.',
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: 'Need a refresher? Use `look` mid-fight to review the room and opponents.',
          },
        ],
      },
    ],
  },
  [HELP_ACTIONS.ABILITIES]: {
    text: 'Abilities & Power',
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: 'Abilities & Power', emoji: true },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Unlocking Abilities*\n• New abilities unlock automatically at level milestones.\n• Spend ability points from the `stats` view to slot or upgrade them.',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Using Abilities*\n• Abilities appear as options during combat alongside `attack`.\n• Many consume stamina or have cooldowns—plan combos with your party.',
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: 'Pro tip: Reroll before completing character creation if you want different starting abilities.',
          },
        ],
      },
    ],
  },
} satisfies Record<string, HelpDetailMessage>;

async function sendHelpDetailViaDM(
  client: WebClient,
  userId: string,
  message: HelpDetailMessage,
) {
  const dm = await client.conversations.open({ users: userId });
  const channel = dm.channel?.id;
  if (!channel) return;
  await client.chat.postMessage({
    channel,
    text: message.text,
    blocks: message.blocks,
  });
}

export function registerActions(app: App) {
  // Format helpers for readable combat logs
  const extractCombatLogLines = (fullText: string): string[] => {
    const marker = '**Combat Log:**';
    const start = fullText.indexOf(marker);
    const text = start >= 0 ? fullText.slice(start + marker.length) : fullText;

    const regex = /Round\s+(\d+)\s*:\s*([\s\S]*?)(?=(?:Round\s+\d+\s*:)|$)/gi;
    const lines: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      const roundNo = m[1];
      const desc = (m[2] || '').replace(/\s+/g, ' ').trim();
      if (roundNo) {
        lines.push(`• Round ${roundNo}: ${desc}`);
      }
    }

    if (lines.length > 0) return lines;

    // Fallback: break on ". Round" or newlines
    const rough = text.replace(/\.?\s+(?=Round\s+\d+\s*:)/g, '\n');
    const fallback = rough
      .split(/\n+/)
      .map((s) => s.trim())
      .filter((s) => /^Round\s+\d+\s*:/i.test(s))
      .map((s) => `• ${s}`);
    return fallback;
  };

  const chunk = <T>(arr: T[], size: number): T[][] => {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };
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

  app.action<BlockAction>(
    HELP_ACTIONS.INVENTORY,
    async ({ ack, body, client }) => {
      await ack();
      const userId = body.user?.id;
      if (!userId) return;
      await dispatchCommandViaDM(client, userId, COMMANDS.INVENTORY);
    },
  );

  for (const [actionId, message] of Object.entries(helpDetailMessages)) {
    app.action<BlockAction>(actionId, async ({ ack, body, client }) => {
      await ack();
      const userId = body.user?.id;
      if (!userId) return;
      await sendHelpDetailViaDM(client, userId, message);
    });
  }

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
      const messageTs =
        typeof body.message?.ts === 'string'
          ? body.message.ts
          : typeof body.container?.message_ts === 'string'
            ? body.container.message_ts
            : undefined;
      const messageBlocks =
        (body.message?.blocks as KnownBlock[] | undefined) ?? undefined;
      if (!userId || !channelId) {
        return;
      }

      const selected = extractSelectedTarget(
        body.state?.values as SlackBlockState | undefined,
      );

      if (!selected) {
        await client.chat.postMessage({
          channel: channelId,
          text: 'Please select a monster to attack first!',
        });
        return;
      }

      if (channelId && messageTs) {
        const targetName = selected.name || 'target';
        const attackProgressText = `Attacking ${targetName}...`;
        const updatedBlocks = buildBlocksWithAttackInProgress(
          messageBlocks,
          attackProgressText,
        );
        if (updatedBlocks) {
          try {
            await client.chat.update({
              channel: channelId,
              ts: messageTs,
              text: attackProgressText,
              blocks: updatedBlocks,
            });
          } catch (err) {
            console.warn('Failed to update attack button state', err);
          }
        }
      }

      try {
        const isMonster = selected.kind === 'monster';
        if (!isMonster && selected.slackId === userId) {
          await client.chat.postMessage({
            channel: channelId,
            text: SELF_ATTACK_ERROR,
          });
          return;
        }
        const attackResult = await dmClient.attack({
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

        if (!attackResult.success) {
          await client.chat.postMessage({
            channel: channelId,
            text: `Attack failed: ${attackResult.message}`,
          });
          return;
        }

        const combat = attackResult.data;
        if (!combat) {
          await client.chat.postMessage({
            channel: channelId,
            text: 'Attack succeeded but no combat data returned.',
          });
          return;
        }

        // Avoid posting full combat summaries in-channel to prevent duplicates.
        // NotificationService will DM the combatants with detailed results.
        await client.chat.postMessage({
          channel: channelId,
          text: '⚔️ Combat initiated! Check your DMs for the results.',
        });
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
          const result = await dmClient.spendSkillPoint({
            slackId: toClientId(userId),
            attribute,
          });
          if (!result.success || !result.data) {
            const errorText =
              result.message ?? 'Unable to spend a skill point right now.';
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
            const statsMessage = buildPlayerStatsMessage(result.data, {
              isSelf: true,
            });
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

  // Toggle full combat log visibility in DM notifications
  app.action<BlockAction>(
    COMBAT_ACTIONS.SHOW_LOG,
    async ({ ack, body, client }) => {
      await ack();

      const channelId =
        body.channel?.id ||
        (typeof body.container?.channel_id === 'string'
          ? body.container.channel_id
          : undefined);
      const messageTs =
        (typeof body.message?.ts === 'string' ? body.message.ts : undefined) ||
        (typeof body.container?.message_ts === 'string'
          ? body.container.message_ts
          : undefined);

      if (!channelId || !messageTs) return;

      // The full narrative including the log is stored in message.text
      const fullText =
        typeof body.message?.text === 'string' ? body.message.text : '';

      // Try to extract only the Combat Log portion if present
      const logText = (() => {
        const idx = fullText.indexOf('**Combat Log:**');
        if (idx >= 0) {
          return fullText.slice(idx);
        }
        return fullText;
      })();

      // Build new blocks: keep the summary, add a readable, chunked combat log, and swap button to Hide
      const originalBlocks = (body.message?.blocks || []) as (
        | KnownBlock
        | Block
      )[];
      const summarySection = originalBlocks.find(
        (b): b is SectionBlock =>
          typeof (b as { type?: string }).type === 'string' &&
          (b as { type?: string }).type === 'section',
      );

      const newBlocks: (KnownBlock | Block)[] = [];
      if (summarySection) newBlocks.push(summarySection);
      const divider: DividerBlock = { type: 'divider' };
      newBlocks.push(divider);

      // Header for the log
      newBlocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: '*Combat Log*' },
      } as SectionBlock);

      const lines = extractCombatLogLines(fullText);
      if (lines.length > 0) {
        for (const group of chunk(lines, 12)) {
          newBlocks.push({
            type: 'section',
            text: { type: 'mrkdwn', text: group.join('\n') },
          } as SectionBlock);
        }
      } else {
        // Fallback: show as preformatted if parsing failed
        newBlocks.push({
          type: 'section',
          text: { type: 'mrkdwn', text: '```' + logText + '```' },
        } as SectionBlock);
      }

      const hideButton: Button = {
        type: 'button',
        action_id: COMBAT_ACTIONS.HIDE_LOG,
        text: { type: 'plain_text', text: 'Hide combat log' },
        style: 'danger',
      };
      const actions: ActionsBlock = { type: 'actions', elements: [hideButton] };
      newBlocks.push(actions);

      await client.chat.update({
        channel: channelId,
        ts: messageTs,
        text: fullText,
        blocks: newBlocks.filter((b): b is KnownBlock => 'type' in b),
      });
    },
  );

  app.action<BlockAction>(
    COMBAT_ACTIONS.HIDE_LOG,
    async ({ ack, body, client }) => {
      await ack();

      const channelId =
        body.channel?.id ||
        (typeof body.container?.channel_id === 'string'
          ? body.container.channel_id
          : undefined);
      const messageTs =
        (typeof body.message?.ts === 'string' ? body.message.ts : undefined) ||
        (typeof body.container?.message_ts === 'string'
          ? body.container.message_ts
          : undefined);

      if (!channelId || !messageTs) return;

      // Restore to the original summary section + Show button
      const originalBlocks = (body.message?.blocks || []) as (
        | KnownBlock
        | Block
      )[];
      const summarySection = originalBlocks.find(
        (b): b is SectionBlock =>
          typeof (b as { type?: string }).type === 'string' &&
          (b as { type?: string }).type === 'section',
      );

      // Fallback if missing
      const blocks: (KnownBlock | Block)[] = [];
      if (summarySection) blocks.push(summarySection);
      const showButton: Button = {
        type: 'button',
        action_id: COMBAT_ACTIONS.SHOW_LOG,
        text: { type: 'plain_text', text: 'View full combat log' },
        style: 'primary',
      };
      const showActions: ActionsBlock = {
        type: 'actions',
        elements: [showButton],
      };
      blocks.push(showActions);

      const fullText =
        typeof body.message?.text === 'string' ? body.message.text : '';

      await client.chat.update({
        channel: channelId,
        ts: messageTs,
        text: fullText,
        blocks: blocks.filter((b): b is KnownBlock => 'type' in b),
      });
    },
  );
}
