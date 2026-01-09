import { HandlerContext } from './types';
import { COMMANDS } from '../commands';
import { PlayerCommandHandler } from './base';
import { buildDeleteCharacterView } from '../actions/characterActions';

export const deleteHandlerHelp =
  'Retire your character anytime with "delete". Example: Send "delete" whenever you want to start fresh.';

export class DeleteHandler extends PlayerCommandHandler {
  constructor() {
    super(COMMANDS.DELETE, 'Failed to delete character', {
      missingCharacterMessage: `You don't have a character to delete! Use "new CharacterName" to create one.`,
    });
  }

  protected async perform({
    say,
    client,
    triggerId,
    userId,
  }: HandlerContext): Promise<void> {
    const player = this.player;
    if (!player) {
      return;
    }
    if (client?.views?.open && triggerId && this.teamId) {
      await client.views.open({
        trigger_id: triggerId,
        view: buildDeleteCharacterView({
          teamId: this.teamId,
          userId,
        }),
      });
      return;
    }

    await say({
      text: 'Deleting a character is permanent. Open the Home tab and choose Delete Character to continue.',
    });
  }
}

export const deleteHandler = new DeleteHandler();
