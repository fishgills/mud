import { registerHandler } from './handlerRegistry';
import { dmSdk } from '../gql-client';
import { HandlerContext } from './types';
import { getUserFriendlyErrorMessage } from './errorUtils';

export const deleteHandlerHelp = `Delete your character during creation with "delete". Example: Send "delete" to delete your character if it's still in creation phase (before completion).`;

export const deleteHandler = async ({ userId, say }: HandlerContext) => {
  try {
    // First, get the current player to check if they're in creation phase
    const playerResult = await dmSdk.GetPlayer({ slackId: userId });

    if (!playerResult.getPlayer.success || !playerResult.getPlayer.data) {
      await say({
        text: `You don't have a character to delete! Use "new CharacterName" to create one.`,
      });
      return;
    }

    const player = playerResult.getPlayer.data;

    // Check if player is in creation phase
    // Based on complete.ts, completion sets HP to 10, so creation phase likely has HP <= 1
    // Also check if they're at starting position and low level
    const isInCreationPhase =
      player.hp <= 1 || (player.level <= 1 && player.xp === 0);

    if (!isInCreationPhase) {
      await say({
        text: `Cannot delete character after creation is complete! Your character "${player.name}" has ${player.hp} HP, is level ${player.level}, and is already active in the game. Character deletion is only allowed during the creation phase.`,
      });
      return;
    }

    // Delete the character using the proper GraphQL mutation
    const deleteResult = await dmSdk.DeletePlayer({ slackId: userId });

    if (deleteResult.deletePlayer.success) {
      await say({
        text: `✅ Character "${player.name}" has been successfully deleted during creation phase. You can create a new character with "new CharacterName"`,
      });
    } else {
      await say({
        text: `Failed to delete character: ${deleteResult.deletePlayer.message}`,
      });
    }
  } catch (err: unknown) {
    const errorMessage = getUserFriendlyErrorMessage(
      err,
      'Failed to delete character',
    );
    await say({ text: errorMessage });
  }
};

// Register handler for text command only
registerHandler('delete', deleteHandler);
