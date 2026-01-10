import { PlayerCommandHandler } from './base';
import type { HandlerContext } from './types';
import type { FeedbackHistoryItem } from '../dm-client';
import type { KnownBlock, Button } from '@slack/types';
import { FEEDBACK_ACTIONS } from '../commands';

const COMMANDS = {
  FEEDBACK: 'feedback',
};

export class FeedbackHistoryHandler extends PlayerCommandHandler {
  constructor() {
    super([COMMANDS.FEEDBACK], 'Failed to load feedback history', {
      allowInHq: true,
      requirePlayer: true,
    });
  }

  protected async perform(ctx: HandlerContext): Promise<void> {
    if (!this.player) {
      await ctx.say({ text: 'You need a character to view feedback history.' });
      return;
    }

    const result = await this.dm.getFeedbackHistory(this.player.id);
    const feedbacks = result.feedbacks ?? [];

    if (feedbacks.length === 0) {
      await ctx.say({
        text: '📋 *Your Feedback History*\n\n_You haven\'t submitted any feedback yet. Use the "Give Feedback" button on the Home tab to share your thoughts!_',
      });
      return;
    }

    // Build blocks with delete buttons for deletable feedback
    const blocks: KnownBlock[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📋 Your Feedback History',
          emoji: true,
        },
      },
    ];

    for (const [index, f] of feedbacks.entries()) {
      const typeEmoji = this.getTypeEmoji(f.type);
      const statusLine = this.getStatusLine(f);
      const date = this.formatDate(f.createdAt);
      const summary = f.summary ?? f.type;

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${index + 1}.* ${typeEmoji} "${summary}"\n${statusLine}\nSubmitted: ${date}`,
        },
        ...(this.canDelete(f)
          ? {
              accessory: {
                type: 'button',
                text: { type: 'plain_text', text: '🗑️ Delete', emoji: true },
                style: 'danger',
                action_id: `${FEEDBACK_ACTIONS.DELETE}:${f.id}`,
                confirm: {
                  title: { type: 'plain_text', text: 'Delete Feedback?' },
                  text: {
                    type: 'mrkdwn',
                    text: 'Are you sure you want to delete this feedback? This cannot be undone.',
                  },
                  confirm: { type: 'plain_text', text: 'Delete' },
                  deny: { type: 'plain_text', text: 'Cancel' },
                },
              } as Button,
            }
          : {}),
      });
    }

    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: '_Showing last 5 submissions_' }],
    });

    await ctx.say({ blocks, text: 'Your Feedback History' });
  }

  private canDelete(item: FeedbackHistoryItem): boolean {
    // Can only delete pending or rejected feedback (not submitted to GitHub)
    return item.status !== 'submitted' || !item.githubIssueUrl;
  }

  private getTypeEmoji(type: string): string {
    switch (type) {
      case 'bug':
        return '🐛';
      case 'suggestion':
        return '💡';
      default:
        return '💬';
    }
  }

  private getStatusLine(item: FeedbackHistoryItem): string {
    const statusIcon = this.getStatusIcon(item.status);
    const statusLabel = this.getStatusLabel(item.status);

    let line = `Status: ${statusIcon} ${statusLabel}`;

    if (item.githubIssueUrl && item.status === 'submitted') {
      line += ` • <${item.githubIssueUrl}|View on GitHub>`;
    }

    return line;
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case 'submitted':
        return '✅';
      case 'rejected':
        return '❌';
      case 'pending':
      default:
        return '⏳';
    }
  }

  private getStatusLabel(status: string): string {
    switch (status) {
      case 'submitted':
        return 'Submitted';
      case 'rejected':
        return 'Rejected';
      case 'pending':
      default:
        return 'Pending';
    }
  }

  private formatDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  }
}

export const feedbackHistoryHandler = new FeedbackHistoryHandler();
