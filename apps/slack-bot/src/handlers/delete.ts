import { HandlerContext } from './types';
import { COMMANDS } from '../commands';
import { PlayerCommandHandler } from './base';

export const deleteHandlerHelp = `Delete your character during creation with "delete". Example: Send "delete" to delete your character if it's still in creation phase (before completion).`;

export class DeleteHandler extends PlayerCommandHandler {
  constructor() {
    super(COMMANDS.DELETE, 'Failed to delete character');
  }

  protected async perform({ userId, say }: HandlerContext): Promise<void> {
    const playerResult = await this.dm.getPlayer({
      slackId: this.toClientId(userId),
    });

    if (!playerResult.success || !playerResult.data) {
      await say({
        text: `You don't have a character to delete! Use "new CharacterName" to create one.`,
      });
      return;
    }

    const player = playerResult.data;
    const isInCreationPhase =
      (player.hp ?? 0) <= 1 ||
      ((player.level ?? 0) <= 1 && (player.xp ?? 0) === 0);

    if (!isInCreationPhase) {
      await say({
        text: `Cannot delete character after creation is complete! Your character "${player.name}" has ${player.hp} HP, is level ${player.level}, and is already active in the game. Character deletion is only allowed during the creation phase.`,
      });
      return;
    }

    const deleteResult = await this.dm.deletePlayer({
      slackId: this.toClientId(userId),
    });

    if (deleteResult.success) {
      await say({
        text: `✅ Character "${player.name}" has been successfully deleted during creation phase. You can create a new character with "new CharacterName"`,
      });
      return;
    }

    await say({
      text: `Failed to delete character: ${deleteResult.message}`,
    });
  }
}

export const deleteHandler = new DeleteHandler();
