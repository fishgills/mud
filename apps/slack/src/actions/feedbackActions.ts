import type { App, BlockAction, ViewSubmitAction } from '@slack/bolt';
import type { ModalView, KnownBlock } from '@slack/types';
import { FEEDBACK_ACTIONS } from '../commands';
import { dmClient } from '../dm-client';
import { getUserFriendlyErrorMessage } from '../handlers/errorUtils';

const FEEDBACK_MODAL_VIEW_ID = 'feedback_modal_submit';

interface FeedbackModalMetadata {
  teamId: string;
  userId: string;
  playerId?: number;
}

const buildFeedbackModal = (metadata: FeedbackModalMetadata): ModalView => {
  const blocks: KnownBlock[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'Your feedback helps make the game better! Tell us about bugs, suggestions, or anything else on your mind.',
      },
    },
    {
      type: 'input',
      block_id: 'feedback_type_block',
      element: {
        type: 'static_select',
        action_id: 'feedback_type',
        placeholder: {
          type: 'plain_text',
          text: 'Select feedback type',
        },
        options: [
          {
            text: { type: 'plain_text', text: '🐛 Bug Report', emoji: true },
            value: 'bug',
          },
          {
            text: { type: 'plain_text', text: '💡 Suggestion', emoji: true },
            value: 'suggestion',
          },
          {
            text: {
              type: 'plain_text',
              text: '💬 General Feedback',
              emoji: true,
            },
            value: 'general',
          },
        ],
        initial_option: {
          text: {
            type: 'plain_text',
            text: '💬 General Feedback',
            emoji: true,
          },
          value: 'general',
        },
      },
      label: {
        type: 'plain_text',
        text: 'Feedback Type',
      },
    },
    {
      type: 'input',
      block_id: 'feedback_content_block',
      element: {
        type: 'plain_text_input',
        action_id: 'feedback_content',
        multiline: true,
        min_length: 10,
        max_length: 2000,
        placeholder: {
          type: 'plain_text',
          text: "Tell us what's on your mind...",
        },
      },
      label: {
        type: 'plain_text',
        text: 'Description',
      },
      hint: {
        type: 'plain_text',
        text: 'Minimum 10 characters. Be as detailed as you like!',
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: '📝 Your feedback is reviewed before being submitted. You can check the status of your feedback by typing `feedback` in a DM with the bot.',
        },
      ],
    },
  ];

  return {
    type: 'modal',
    callback_id: FEEDBACK_MODAL_VIEW_ID,
    private_metadata: JSON.stringify(metadata),
    title: { type: 'plain_text', text: 'Give Feedback' },
    submit: { type: 'plain_text', text: 'Submit' },
    close: { type: 'plain_text', text: 'Cancel' },
    blocks,
  };
};

export const registerFeedbackActions = (app: App) => {
  // Open feedback modal
  app.action<BlockAction>(
    FEEDBACK_ACTIONS.OPEN_MODAL,
    async ({ ack, body, client, context }) => {
      await ack();

      const userId = body.user?.id;
      const teamId = body.team?.id ?? (context as { teamId?: string })?.teamId;
      const triggerId = body.trigger_id;

      if (!userId || !teamId || !triggerId) {
        return;
      }

      try {
        // Get player info for metadata
        const playerResult = await dmClient.getPlayer({ teamId, userId });
        const playerId = playerResult.data?.id;

        await client.views.open({
          trigger_id: triggerId,
          view: buildFeedbackModal({
            teamId,
            userId,
            playerId,
          }),
        });
      } catch {
        // Still try to open modal without player ID
        await client.views.open({
          trigger_id: triggerId,
          view: buildFeedbackModal({
            teamId,
            userId,
          }),
        });
      }
    },
  );

  // Handle feedback modal submission
  app.view<ViewSubmitAction>(
    FEEDBACK_MODAL_VIEW_ID,
    async ({ ack, view, client }) => {
      const metadata: FeedbackModalMetadata = JSON.parse(
        view.private_metadata || '{}',
      );
      const { teamId, userId, playerId } = metadata;

      // Extract values from modal
      const typeValue =
        view.state.values?.feedback_type_block?.feedback_type?.selected_option
          ?.value ?? 'general';
      const contentValue =
        view.state.values?.feedback_content_block?.feedback_content?.value ??
        '';

      // Validate content
      if (contentValue.length < 10) {
        await ack({
          response_action: 'errors',
          errors: {
            feedback_content_block:
              'Please provide at least 10 characters of feedback.',
          },
        });
        return;
      }

      // Close modal immediately with acknowledgement
      await ack();

      // Submit feedback to DM service
      try {
        if (!playerId) {
          // Need player ID - fetch it
          const playerResult = await dmClient.getPlayer({ teamId, userId });
          if (!playerResult.success || !playerResult.data) {
            await sendFeedbackDM(client, userId, {
              success: false,
              message:
                "Couldn't submit feedback - you need a character first! Type `new` to create one.",
            });
            return;
          }
          metadata.playerId = playerResult.data.id;
        }

        const result = await dmClient.submitFeedback({
          playerId: metadata.playerId!,
          type: typeValue as 'bug' | 'suggestion' | 'general',
          content: contentValue,
        });

        await sendFeedbackDM(client, userId, {
          success: result.success,
          message: result.success
            ? result.githubIssueUrl
              ? `✅ Thank you for your feedback! It has been submitted for review.`
              : `✅ Thank you for your feedback! It has been recorded.`
            : `❌ ${result.rejectionReason ?? 'Unable to submit feedback at this time.'}`,
          githubUrl: result.githubIssueUrl,
        });
      } catch (err) {
        const errorMessage = getUserFriendlyErrorMessage(
          err,
          'Unable to submit feedback',
        );
        await sendFeedbackDM(client, userId, {
          success: false,
          message: `❌ ${errorMessage}`,
        });
      }
    },
  );
};

async function sendFeedbackDM(
  client: App['client'],
  userId: string,
  result: { success: boolean; message: string; githubUrl?: string },
) {
  try {
    const dm = await client.conversations.open({ users: userId });
    const channel = dm.channel?.id;
    if (!channel) return;

    const blocks: KnownBlock[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: result.message,
        },
      },
    ];

    if (result.success) {
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: 'Type `feedback` to see the status of your past submissions.',
          },
        ],
      });
    }

    await client.chat.postMessage({
      channel,
      text: result.message,
      blocks,
    });
  } catch {
    // Silently fail DM - user will see the modal close
  }
}
