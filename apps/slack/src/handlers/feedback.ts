import { PlayerCommandHandler } from './base';
import type { HandlerContext } from './types';
import type { FeedbackHistoryItem } from '../dm-client';

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

    const lines = feedbacks.map((f, index) =>
      this.formatFeedbackItem(f, index + 1),
    );
    const message = [
      '📋 *Your Feedback History*',
      '',
      ...lines,
      '',
      '_Showing last 5 submissions_',
    ].join('\n');

    await ctx.say({ text: message });
  }

  private formatFeedbackItem(item: FeedbackHistoryItem, index: number): string {
    const typeEmoji = this.getTypeEmoji(item.type);
    const statusLine = this.getStatusLine(item);
    const date = this.formatDate(item.createdAt);
    const summary = item.summary ?? item.type;

    const parts = [
      `*${index}.* ${typeEmoji} "${summary}"`,
      `   ${statusLine}`,
      `   Submitted: ${date}`,
    ];

    return parts.join('\n');
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
    const reason = item.status === 'rejected' ? ` (${item.type})` : '';

    let line = `Status: ${statusIcon} ${statusLabel}${reason}`;

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
