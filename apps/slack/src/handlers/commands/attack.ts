import { COMMANDS } from '../../commands';
import { PlayerCommandHandler } from '../base';
import type { HandlerContext } from '../types';
import { dmClient } from '../../dm-client';
import { AttackOrigin, TargetType } from '../../dm-types';
import { getUserFriendlyErrorMessage } from '../errorUtils';

export const SELF_ATTACK_ERROR = "You can't attack yourself.";

export class AttackHandler extends PlayerCommandHandler {
  constructor() {
    super(COMMANDS.ATTACK, 'Failed to start a duel', { requirePlayer: true });
  }

  protected async perform({ teamId, userId, text, say }: HandlerContext) {
    const target = text.split(/\s+/).slice(1).join(' ').trim();
    if (!target) {
      await say({ text: 'Use `attack @name` to duel another player.' });
      return;
    }

    const mentionMatch = target.match(/^<@([A-Z0-9]+)>$/i);
    const targetUserId = mentionMatch?.[1];
    const targetName = mentionMatch
      ? undefined
      : target.replace(/^@/, '').trim();

    if (targetUserId && targetUserId === userId) {
      await say({ text: SELF_ATTACK_ERROR });
      return;
    }

    try {
      const result = await dmClient.attack({
        teamId,
        userId,
        input: {
          targetType: TargetType.Player,
          targetUserId,
          targetTeamId: targetUserId ? teamId : undefined,
          targetName: targetName || undefined,
          attackOrigin: targetUserId ? AttackOrigin.TextPvp : undefined,
        },
      });

      if (!result.success) {
        await say({ text: result.message ?? 'Unable to start a duel.' });
        return;
      }

      await say({ text: 'Duel started. Check your DMs for combat results.' });
    } catch (err) {
      const message = getUserFriendlyErrorMessage(
        err,
        'Unable to start a duel.',
      );
      await say({ text: message });
    }
  }
}

export const attackHandler = new AttackHandler();
