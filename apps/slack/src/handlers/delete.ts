import { HandlerContext } from './types';
import { COMMANDS } from '../commands';
import { PlayerCommandHandler } from './base';

export const deleteHandlerHelp =
  'Retire your character anytime with "delete". Example: Send "delete" whenever you want to start fresh.';

export class DeleteHandler extends PlayerCommandHandler {
  constructor() {
    super(COMMANDS.DELETE, 'Failed to delete character');
  }

  protected async perform({ userId, say }: HandlerContext): Promise<void> {
    const playerResult = await this.dm.getPlayer({
      teamId: this.teamId,
      userId,
    });

    if (!playerResult.success || !playerResult.data) {
      await say({
        text: `You don't have a character to delete! Use "new CharacterName" to create one.`,
      });
      return;
    }

    const player = playerResult.data;
    const playerName = player.name ?? 'your character';
    const deleteResult = await this.dm.deletePlayer({
      teamId: this.teamId,
      userId,
    });

    if (deleteResult.success) {
      await say({
        text: `💨 ${playerName} vanishes into legend. Ready for round two? Try "new CharacterName" to forge a fresh hero!`,
      });
      return;
    }

    await say({
      text: `Failed to delete character: ${deleteResult.message}`,
    });
  }
}

export const deleteHandler = new DeleteHandler();
