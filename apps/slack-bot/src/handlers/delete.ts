import { HandlerContext } from './types';
import { COMMANDS } from '../commands';
import { PlayerCommandHandler } from './base';

export const deleteHandlerHelp = `Delete your character during creation with "delete". Example: Send "delete" to delete your character if it's still in creation phase (before completion).`;

export class DeleteHandler extends PlayerCommandHandler {
  constructor() {
    super(COMMANDS.DELETE, 'Failed to delete character');
  }

  protected async perform({ userId, say }: HandlerContext): Promise<void> {
    const playerResult = await this.sdk.GetPlayer({
      slackId: this.toClientId(userId),
    });

    if (!playerResult.getPlayer.success || !playerResult.getPlayer.data) {
      await say({
        text: `You don't have a character to delete! Use "new CharacterName" to create one.`,
      });
      return;
    }

    const player = playerResult.getPlayer.data;
    const isInCreationPhase =
      player.hp <= 1 || (player.level <= 1 && player.xp === 0);

    if (!isInCreationPhase) {
      await say({
        text: `Cannot delete character after creation is complete! Your character "${player.name}" has ${player.hp} HP, is level ${player.level}, and is already active in the game. Character deletion is only allowed during the creation phase.`,
      });
      return;
    }

    const deleteResult = await this.sdk.DeletePlayer({
      slackId: this.toClientId(userId),
    });

    if (deleteResult.deletePlayer.success) {
      await say({
        text: `✅ Character "${player.name}" has been successfully deleted during creation phase. You can create a new character with "new CharacterName"`,
      });
      return;
    }

    await say({
      text: `Failed to delete character: ${deleteResult.deletePlayer.message}`,
    });
  }
}

export const deleteHandler = new DeleteHandler();
