import { HandlerContext } from './types';
import { COMMANDS, HOME_ACTIONS } from '../commands';
import { PlayerCommandHandler } from './base';

export const deleteHandlerHelp =
  'Retire your character anytime with "delete". Example: Send "delete" whenever you want to start fresh.';

export class DeleteHandler extends PlayerCommandHandler {
  constructor() {
    super(COMMANDS.DELETE, 'Failed to delete character', {
      missingCharacterMessage: `You don't have a character to delete! Use "new CharacterName" to create one.`,
    });
  }

  protected async perform({ say }: HandlerContext): Promise<void> {
    const player = this.player;
    if (!player) {
      return;
    }
    await say({
      text: 'Deleting a character is permanent. Confirm below to continue.',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Delete Character*\nThis will permanently delete your character and all progress.',
          },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Delete Character' },
              style: 'danger',
              action_id: HOME_ACTIONS.DELETE_CHARACTER,
            },
          ],
        },
      ],
    });
  }
}

export const deleteHandler = new DeleteHandler();
