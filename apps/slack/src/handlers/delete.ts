import { HandlerContext } from './types';
import { COMMANDS } from '../commands';
import { PlayerCommandHandler } from './base';

export const deleteHandlerHelp =
  'Retire your character anytime with "delete". Example: Send "delete" whenever you want to start fresh.';

export class DeleteHandler extends PlayerCommandHandler {
  constructor() {
    super(COMMANDS.DELETE, 'Failed to delete character', {
      missingCharacterMessage: `You don't have a character to delete! Use "new CharacterName" to create one.`,
    });
  }

  protected async perform({ userId, say }: HandlerContext): Promise<void> {
    const player = this.player;
    if (!player) {
      return;
    }
    const playerName = player.name ?? 'your character';
    const deleteResult = await this.dm.deletePlayer({
      teamId: this.teamId!,
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
