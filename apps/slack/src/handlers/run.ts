import { COMMANDS } from '../commands';
import { PlayerCommandHandler } from './base';
import type { HandlerContext } from './types';

const formatRunType = (value?: string) =>
  value ? value.toLowerCase() : 'solo';

const renderRunSummary = (run: {
  runType: string;
  round: number;
  bankedXp: number;
  bankedGold: number;
}) =>
  `Active ${formatRunType(run.runType)} raid - round ${run.round}. Banked rewards: ${run.bankedXp} XP, ${run.bankedGold} gold.`;

export class RunHandler extends PlayerCommandHandler {
  constructor() {
    super(COMMANDS.RUN, 'Unable to start a raid');
  }

  protected async perform({ teamId, userId, text, say }: HandlerContext) {
    const tokens = text.trim().split(/\s+/);
    const subcommand = tokens[1]?.toLowerCase();

    if (subcommand === 'status' || subcommand === 'info') {
      const active = await this.dm.getActiveRun({ teamId, userId });
      if (!active.success) {
        await say({ text: active.message ?? 'Unable to load raid status.' });
        return;
      }
      if (!active.data) {
        await say({ text: 'You do not have an active raid.' });
        return;
      }
      await say({ text: renderRunSummary(active.data) });
      return;
    }

    const active = await this.dm.getActiveRun({ teamId, userId });
    if (active.success && active.data) {
      await say({ text: renderRunSummary(active.data) });
      return;
    }

    const runType =
      subcommand === 'guild'
        ? 'guild'
        : subcommand === 'solo'
          ? 'solo'
          : undefined;
    if (subcommand && !runType) {
      await say({
        text: `Try \`${COMMANDS.RUN}\`, \`${COMMANDS.RUN} solo\`, or \`${COMMANDS.RUN} guild\` to start a raid.`,
      });
      return;
    }

    const result = await this.dm.startRun({
      teamId,
      userId,
      type: runType,
    });

    if (!result.success) {
      await say({ text: result.message ?? 'Unable to start a raid.' });
      return;
    }

    await say({
      text: 'Raid started. Check your DMs for round results.',
    });
  }
}

export const runHandler = new RunHandler();
