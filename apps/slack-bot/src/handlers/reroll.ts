import { HandlerContext } from './types';
import { COMMANDS } from '../commands';
import { PlayerCommandHandler } from './base';

export const rerollHandlerHelp = `Reroll your character's stats with "reroll". Example: Send "reroll" to reroll stats during character creation.`;

export class RerollHandler extends PlayerCommandHandler {
  constructor() {
    super(COMMANDS.REROLL, 'Failed to reroll stats');
  }

  protected async perform({ userId, say }: HandlerContext): Promise<void> {
    const result = await this.dm.rerollPlayerStats({
      slackId: this.toClientId(userId),
    });
    if (result.success) {
      const stats = result.data;
      await say({
        text: `🎲 Rerolled stats: Strength: ${stats?.strength}, Agility: ${stats?.agility}, Vitality: ${stats?.health}, Health Points: ${stats?.maxHp}`,
      });
      return;
    }

    await say({ text: `Error: ${result.message}` });
  }
}

export const rerollHandler = new RerollHandler();
