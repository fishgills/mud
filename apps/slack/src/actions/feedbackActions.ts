import type { App, BlockAction, ViewSubmitAction } from '@slack/bolt';
import type { ModalView, KnownBlock } from '@slack/types';
import { FEEDBACK_ACTIONS } from '../commands';
import { dmClient } from '../dm-client';
import { getUserFriendlyErrorMessage } from '../handlers/errorUtils';
import { getActionContext, postToUser } from './helpers';

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
  app.logger?.debug?.(
    '[FEEDBACK-ACTIONS] Registering feedback action handlers',
  );

  // Open feedback modal
  app.action<BlockAction>(
    FEEDBACK_ACTIONS.OPEN_MODAL,
    async ({ ack, body, client, context, logger }) => {
      await ack();
      logger?.debug?.('[FEEDBACK-ACTIONS] Open modal action triggered');

      const { userId, teamId, triggerId } = getActionContext(body, context);

      if (!userId || !teamId || !triggerId) {
        logger?.warn?.(
          '[FEEDBACK-ACTIONS] Missing required fields for modal open',
        );
        return;
      }

      try {
        // Get player info for metadata
        logger?.debug?.(
          `[FEEDBACK-ACTIONS] Fetching player for userId=${userId}`,
        );
        const playerResult = await dmClient.getPlayer({ teamId, userId });
        const playerId = playerResult.data?.id;
        logger?.debug?.(
          `[FEEDBACK-ACTIONS] Player lookup result: playerId=${playerId ?? 'none'}`,
        );

        await client.views.open({
          trigger_id: triggerId,
          view: buildFeedbackModal({
            teamId,
            userId,
            playerId,
          }),
        });
        logger?.debug?.(
          '[FEEDBACK-ACTIONS] Feedback modal opened successfully',
        );
      } catch {
        logger?.warn?.(
          '[FEEDBACK-ACTIONS] Failed to get player, opening modal without playerId',
        );
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

  // Handle feedback delete action
  app.action<BlockAction>(
    new RegExp(`^${FEEDBACK_ACTIONS.DELETE}:\\d+$`),
    async ({ ack, body, client, context, action, logger }) => {
      await ack();

      const { userId, teamId } = getActionContext(body, context);

      if (!userId || !teamId) {
        logger?.warn?.(
          '[FEEDBACK-ACTIONS] Missing userId or teamId for delete',
        );
        return;
      }

      // Extract feedback ID from action_id
      const actionId = 'action_id' in action ? action.action_id : '';
      const feedbackIdMatch = actionId.match(/:(\d+)$/);
      if (!feedbackIdMatch) {
        logger?.warn?.(
          `[FEEDBACK-ACTIONS] Could not extract feedbackId from action: ${actionId}`,
        );
        return;
      }
      const feedbackId = parseInt(feedbackIdMatch[1], 10);
      logger?.debug?.(
        `[FEEDBACK-ACTIONS] Delete action for feedbackId=${feedbackId}`,
      );

      try {
        // Get player ID
        const playerResult = await dmClient.getPlayer({ teamId, userId });
        if (!playerResult.success || !playerResult.data) {
          logger?.warn?.(
            '[FEEDBACK-ACTIONS] Player not found for delete action',
          );
          return;
        }
        const playerId = playerResult.data.id;
        logger?.debug?.(
          `[FEEDBACK-ACTIONS] Deleting feedback ${feedbackId} for player ${playerId}`,
        );

        // Delete the feedback
        const result = await dmClient.deleteFeedback(feedbackId, playerId);
        logger?.debug?.(
          `[FEEDBACK-ACTIONS] Delete result: success=${result.success}`,
        );

        // Send DM with result
        await sendFeedbackDM(client, userId, {
          success: result.success,
          message: result.success
            ? '🗑️ Feedback deleted successfully.'
            : `❌ ${result.message ?? 'Unable to delete feedback.'}`,
        });
      } catch (err) {
        logger?.error?.('[FEEDBACK-ACTIONS] Error deleting feedback:', err);
        const errorMessage = getUserFriendlyErrorMessage(
          err,
          'Unable to delete feedback',
        );
        await sendFeedbackDM(client, userId, {
          success: false,
          message: `❌ ${errorMessage}`,
        });
      }
    },
  );

  // Handle feedback modal submission
  app.view<ViewSubmitAction>(
    FEEDBACK_MODAL_VIEW_ID,
    async ({ ack, view, client, logger }) => {
      logger?.debug?.('[FEEDBACK-ACTIONS] Modal submission received');
      const metadata: FeedbackModalMetadata = JSON.parse(
        view.private_metadata || '{}',
      );
      const { teamId, userId, playerId } = metadata;
      logger?.debug?.(
        `[FEEDBACK-ACTIONS] Metadata: teamId=${teamId}, userId=${userId}, playerId=${playerId ?? 'none'}`,
      );

      // Extract values from modal
      const typeValue =
        view.state.values?.feedback_type_block?.feedback_type?.selected_option
          ?.value ?? 'general';
      const contentValue =
        view.state.values?.feedback_content_block?.feedback_content?.value ??
        '';
      logger?.debug?.(
        `[FEEDBACK-ACTIONS] Form values: type=${typeValue}, contentLength=${contentValue.length}`,
      );

      // Validate content
      if (contentValue.length < 10) {
        logger?.debug?.(
          '[FEEDBACK-ACTIONS] Content too short, returning error',
        );
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
      logger?.debug?.(
        '[FEEDBACK-ACTIONS] Modal acknowledged, submitting to DM service',
      );

      // Submit feedback to DM service
      try {
        logger?.debug?.('[FEEDBACK-ACTIONS] Calling dmClient.submitFeedback');
        const result = await dmClient.submitFeedback({
          teamId,
          userId,
          ...(playerId ? { playerId } : {}),
          type: typeValue as 'bug' | 'suggestion' | 'general',
          content: contentValue,
        });
        logger?.debug?.(
          `[FEEDBACK-ACTIONS] Submit result: success=${result.success}, feedbackId=${result.feedbackId ?? 'none'}`,
        );

        await sendFeedbackDM(client, userId, {
          success: result.success,
          message: result.success
            ? result.ignored
              ? '✅ Thanks for taking the time to share feedback.'
              : result.githubIssueUrl
                ? `✅ Thank you for your feedback! It has been submitted for review.`
                : `✅ Thank you for your feedback! It has been recorded.`
            : `❌ ${result.rejectionReason ?? 'Unable to submit feedback at this time.'}`,
          githubUrl: result.githubIssueUrl,
        });
      } catch (err) {
        logger?.error?.('[FEEDBACK-ACTIONS] Error submitting feedback:', err);
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

    await postToUser({
      client,
      userId,
      text: result.message,
      blocks,
    });
  } catch {
    // Silently fail DM - user will see the modal close
  }
}
