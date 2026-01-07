import type { App, BlockAction, ViewSubmitAction } from '@slack/bolt';
import type { KnownBlock, ModalView } from '@slack/types';
import {
  CHARACTER_ACTIONS,
  COMMANDS,
  HELP_ACTIONS,
  HOME_ACTIONS,
} from '../commands';
import { dmClient } from '../dm-client';
import { dispatchCommandViaDM } from './commandDispatch';
import { buildAppHomeBlocks } from '../handlers/appHome';
import { getUserFriendlyErrorMessage } from '../handlers/errorUtils';

const CREATE_CHARACTER_VIEW_ID = 'create_character_view';
const CREATE_CHARACTER_FINALIZE_VIEW_ID = 'create_character_finalize_view';
const DELETE_CHARACTER_VIEW_ID = 'delete_character_view';

const buildCreateCharacterView = (): ModalView => {
  const blocks: KnownBlock[] = [
    {
      type: 'input' as const,
      block_id: 'create_name_block',
      label: { type: 'plain_text' as const, text: 'Hero name' },
      element: {
        type: 'plain_text_input' as const,
        action_id: 'character_name',
        placeholder: {
          type: 'plain_text' as const,
          text: 'e.g., Thalara the Bold',
        },
      },
    },
  ];

  return {
    type: 'modal',
    callback_id: CREATE_CHARACTER_VIEW_ID,
    title: { type: 'plain_text', text: 'Forge Your Hero' },
    submit: { type: 'plain_text', text: 'Continue' },
    close: { type: 'plain_text', text: 'Cancel' },
    blocks,
  };
};

const buildCharacterStatsView = (params: {
  teamId: string;
  userId: string;
  name: string;
  strength?: number | null;
  agility?: number | null;
  health?: number | null;
  maxHp?: number | null;
  errorText?: string;
}): ModalView => {
  const blocks: KnownBlock[] = [
    {
      type: 'section' as const,
      text: {
        type: 'mrkdwn' as const,
        text: `The dice have spoken for *${params.name}*. Review your starting stats:`,
      },
    },
    ...(params.errorText
      ? [
          {
            type: 'context' as const,
            elements: [
              {
                type: 'mrkdwn' as const,
                text: `:warning: ${params.errorText}`,
              },
            ],
          },
        ]
      : []),
    {
      type: 'section' as const,
      block_id: 'stats_preview',
      fields: [
        {
          type: 'mrkdwn' as const,
          text: `*Strength*\n${params.strength ?? '-'}`,
        },
        {
          type: 'mrkdwn' as const,
          text: `*Agility*\n${params.agility ?? '-'}`,
        },
        {
          type: 'mrkdwn' as const,
          text: `*Vitality*\n${params.health ?? '-'}`,
        },
        {
          type: 'mrkdwn' as const,
          text: `*Max HP*\n${params.maxHp ?? '-'}`,
        },
      ],
    },
    {
      type: 'actions' as const,
      elements: [
        {
          type: 'button' as const,
          text: { type: 'plain_text' as const, text: 'Reroll the Dice' },
          action_id: CHARACTER_ACTIONS.REROLL,
        },
      ],
    },
    {
      type: 'context' as const,
      elements: [
        {
          type: 'mrkdwn' as const,
          text: 'When you are ready, press *Start Adventure* to step into the realm.',
        },
      ],
    },
  ];

  return {
    type: 'modal',
    callback_id: CREATE_CHARACTER_FINALIZE_VIEW_ID,
    private_metadata: JSON.stringify({
      teamId: params.teamId,
      userId: params.userId,
      name: params.name,
    }),
    title: { type: 'plain_text', text: 'Starting Stats' },
    submit: { type: 'plain_text', text: 'Start Adventure' },
    close: { type: 'plain_text', text: 'Cancel' },
    blocks,
  };
};

const buildDeleteCharacterView = (params: {
  teamId: string;
  userId: string;
  errorText?: string;
}): ModalView => {
  const blocks: KnownBlock[] = [
    {
      type: 'section' as const,
      text: {
        type: 'mrkdwn' as const,
        text: '*This will permanently delete your character and all progress.*',
      },
    },
    ...(params.errorText
      ? [
          {
            type: 'context' as const,
            elements: [
              {
                type: 'mrkdwn' as const,
                text: `:warning: ${params.errorText}`,
              },
            ],
          },
        ]
      : []),
    {
      type: 'actions' as const,
      elements: [
        {
          type: 'button' as const,
          text: { type: 'plain_text' as const, text: 'Delete Character' },
          style: 'danger' as const,
          action_id: CHARACTER_ACTIONS.DELETE_CONFIRM,
          confirm: {
            title: { type: 'plain_text', text: 'Delete character?' },
            text: {
              type: 'mrkdwn',
              text: 'This will permanently delete your character and all progress.',
            },
            confirm: { type: 'plain_text', text: 'Delete' },
            deny: { type: 'plain_text', text: 'Cancel' },
          },
        },
      ],
    },
  ];

  return {
    type: 'modal',
    callback_id: DELETE_CHARACTER_VIEW_ID,
    private_metadata: JSON.stringify({
      teamId: params.teamId,
      userId: params.userId,
    }),
    title: { type: 'plain_text', text: 'Delete Character' },
    close: { type: 'plain_text', text: 'Cancel' },
    blocks,
  };
};

export const registerCharacterActions = (app: App) => {
  app.action<BlockAction>(
    HELP_ACTIONS.CREATE,
    async ({ ack, body, client }) => {
      await ack();
      const triggerId = body.trigger_id;
      if (!triggerId) return;
      try {
        await client.views.open({
          trigger_id: triggerId,
          view: buildCreateCharacterView(),
        });
      } catch {
        const userId = body.user?.id;
        if (!userId) return;
        const dm = await client.conversations.open({ users: userId });
        const channel = dm.channel?.id;
        if (!channel) return;
        await client.chat.postMessage({
          channel,
          text: 'If the portal will not open, type: `new YourName`',
        });
      }
    },
  );

  app.view<ViewSubmitAction>(
    CREATE_CHARACTER_VIEW_ID,
    async ({ ack, body, context }) => {
      const values = body.view.state?.values;
      const name = values?.create_name_block?.character_name?.value?.trim();

      if (!name) {
        await ack({
          response_action: 'errors',
          errors: { create_name_block: 'Please enter a character name.' },
        });
        return;
      }

      const userId = body.user?.id;
      const teamId =
        typeof context.teamId === 'string' ? context.teamId : undefined;
      if (!userId || !teamId) {
        await ack({
          response_action: 'errors',
          errors: { create_name_block: 'Missing team or user information.' },
        });
        return;
      }

      try {
        const result = await dmClient.createPlayer({
          teamId,
          userId,
          name,
        });
        if (!result.success || !result.data) {
          await ack({
            response_action: 'errors',
            errors: {
              create_name_block:
                result.message ?? 'Unable to create character right now.',
            },
          });
          return;
        }

        await ack({
          response_action: 'push',
          view: buildCharacterStatsView({
            teamId,
            userId,
            name: result.data.name ?? name,
            strength: result.data.strength,
            agility: result.data.agility,
            health: result.data.health,
            maxHp: result.data.maxHp,
          }),
        });
      } catch (err) {
        await ack({
          response_action: 'errors',
          errors: {
            create_name_block: getUserFriendlyErrorMessage(
              err,
              'Unable to create character',
            ),
          },
        });
      }
    },
  );

  app.action<BlockAction>(
    CHARACTER_ACTIONS.REROLL,
    async ({ ack, body, client }) => {
      await ack();
      const meta = body.view?.private_metadata
        ? JSON.parse(body.view.private_metadata)
        : null;
      const teamId = meta?.teamId as string | undefined;
      const userId = meta?.userId as string | undefined;
      const name = meta?.name as string | undefined;
      const viewId = body.view?.id;
      const hash = body.view?.hash;

      if (!teamId || !userId || !viewId) return;

      try {
        const result = await dmClient.rerollPlayerStats({ teamId, userId });
        if (!result.success || !result.data) {
          await client.views.update({
            view_id: viewId,
            hash,
            view: buildCharacterStatsView({
              teamId,
              userId,
              name: name ?? 'Adventurer',
              strength: result.data?.strength,
              agility: result.data?.agility,
              health: result.data?.health,
              maxHp: result.data?.maxHp,
              errorText: result.message ?? 'Unable to reroll stats right now.',
            }),
          });
          return;
        }

        await client.views.update({
          view_id: viewId,
          hash,
          view: buildCharacterStatsView({
            teamId,
            userId,
            name: result.data.name ?? name ?? 'Adventurer',
            strength: result.data.strength,
            agility: result.data.agility,
            health: result.data.health,
            maxHp: result.data.maxHp,
          }),
        });
      } catch (err) {
        await client.views.update({
          view_id: viewId,
          hash,
          view: buildCharacterStatsView({
            teamId,
            userId,
            name: name ?? 'Adventurer',
            errorText: getUserFriendlyErrorMessage(
              err,
              'Unable to reroll stats',
            ),
          }),
        });
      }
    },
  );

  app.view<ViewSubmitAction>(
    CREATE_CHARACTER_FINALIZE_VIEW_ID,
    async ({ ack, view, client }) => {
      const meta = view.private_metadata
        ? JSON.parse(view.private_metadata)
        : null;
      const teamId = meta?.teamId as string | undefined;
      const userId = meta?.userId as string | undefined;

      if (!teamId || !userId) {
        await ack();
        return;
      }

      try {
        const result = await dmClient.completePlayer({ teamId, userId });
        if (!result.success) {
          await ack();
          const dm = await client.conversations.open({ users: userId });
          const channel = dm.channel?.id;
          if (channel) {
            await client.chat.postMessage({
              channel,
              text:
                result.message ??
                'Unable to complete character creation right now.',
            });
          }
          return;
        }

        await ack({ response_action: 'clear' });
        await dispatchCommandViaDM(client, userId, COMMANDS.LOOK, teamId);

        if (client.views?.publish) {
          try {
            const blocks = await buildAppHomeBlocks(teamId, userId);
            await client.views.publish({
              user_id: userId,
              view: {
                type: 'home',
                callback_id: 'home_view',
                blocks,
              },
            });
          } catch {
            // Ignore refresh failures so character creation still succeeds.
          }
        }
      } catch (err) {
        await ack();
        const dm = await client.conversations.open({ users: userId });
        const channel = dm.channel?.id;
        if (channel) {
          await client.chat.postMessage({
            channel,
            text: getUserFriendlyErrorMessage(
              err,
              'Failed to complete character creation',
            ),
          });
        }
      }
    },
  );

  app.action<BlockAction>(
    HOME_ACTIONS.DELETE_CHARACTER,
    async ({ ack, body, client, context }) => {
      await ack();
      const userId = body.user?.id;
      const teamId = body.team?.id ?? (context as { teamId?: string })?.teamId;
      const triggerId = body.trigger_id;
      if (!userId || !teamId || !triggerId) return;

      try {
        await client.views.open({
          trigger_id: triggerId,
          view: buildDeleteCharacterView({ teamId, userId }),
        });
      } catch (err) {
        const dm = await client.conversations.open({ users: userId });
        const channel = dm.channel?.id;
        if (channel) {
          await client.chat.postMessage({
            channel,
            text: getUserFriendlyErrorMessage(
              err,
              'Unable to open delete confirmation',
            ),
          });
        }
      }
    },
  );

  app.action<BlockAction>(
    CHARACTER_ACTIONS.DELETE_CONFIRM,
    async ({ ack, body, client }) => {
      await ack();
      const meta = body.view?.private_metadata
        ? JSON.parse(body.view.private_metadata)
        : null;
      const teamId = meta?.teamId as string | undefined;
      const userId = meta?.userId as string | undefined;
      const viewId = body.view?.id;
      const hash = body.view?.hash;

      if (!teamId || !userId || !viewId) return;

      try {
        const result = await dmClient.deletePlayer({ teamId, userId });
        if (!result.success) {
          await client.views.update({
            view_id: viewId,
            hash,
            view: buildDeleteCharacterView({
              teamId,
              userId,
              errorText: result.message ?? 'Unable to delete character.',
            }),
          });
          return;
        }

        const views = client.views as typeof client.views & {
          close?: (args: { view_id: string }) => Promise<unknown>;
        };
        if (views?.close) {
          await views.close({ view_id: viewId });
        }
        const dm = await client.conversations.open({ users: userId });
        const channel = dm.channel?.id;
        if (channel) {
          await client.chat.postMessage({
            channel,
            text: 'Your tale is erased. Ready to roll a new hero?',
          });
        }

        if (client.views?.publish) {
          try {
            const blocks = await buildAppHomeBlocks(teamId, userId);
            await client.views.publish({
              user_id: userId,
              view: {
                type: 'home',
                callback_id: 'home_view',
                blocks,
              },
            });
          } catch {
            // Ignore refresh failures.
          }
        }
      } catch (err) {
        await client.views.update({
          view_id: viewId,
          hash,
          view: buildDeleteCharacterView({
            teamId,
            userId,
            errorText: getUserFriendlyErrorMessage(
              err,
              'Failed to delete character',
            ),
          }),
        });
      }
    },
  );
};
