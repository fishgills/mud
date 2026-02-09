import { HandlerContext } from '../types';

import { COMMANDS } from '../../commands';
import { buildPlayerStatsMessage } from './stats/format';
import { PlayerCommandHandler } from '../base';

export const createHandlerHelp = `Create a new hero with "new". Example: Send "new Thalara" to forge a hero named Thalara.`;

export class CreateHandler extends PlayerCommandHandler {
  constructor() {
    super(COMMANDS.NEW, 'Failed to create character', {
      loadPlayer: false,
      requirePlayer: false,
    });
  }

  protected async perform({
    userId,
    say,
    text,
  }: HandlerContext): Promise<void> {
    const trimmedText = text.trim();
    const parts = trimmedText.split(/\s+/);

    let name = '';
    const newIndex = parts.findIndex(
      (part) => part.toLowerCase() === COMMANDS.NEW,
    );
    if (newIndex !== -1 && parts.length > newIndex + 1) {
      name = parts
        .slice(newIndex + 1)
        .join(' ')
        .trim();
    }

    if (!name) {
      await say({
        text: `Name your hero to begin. Example: "new Thalara"`,
      });
      return;
    }

    const input = {
      teamId: this.teamId,
      userId,
      name,
    };

    try {
      const result = await this.dm.createPlayer(input);
      if (result.success && result.data) {
        const introText = `Welcome <@${userId}>! Your adventure begins.`;
        const instructions =
          'Use the Home tab to reroll the dice and press Start Adventure. Power users can also type `reroll` and `complete`.';
        const statsMessage = buildPlayerStatsMessage(result.data);
        await say({
          text: `${introText} ${instructions} ${statsMessage.text}`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `${introText}\n${instructions}`,
              },
            },
            { type: 'divider' },
            ...(statsMessage.blocks ?? []),
          ],
        });
        return;
      }

      await say({ text: `Error: ${result.message}` });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : String(err ?? 'Unknown error');
      if (/already exists/i.test(message)) {
        await say({ text: `You already have a character!` });
        return;
      }

      throw err;
    }
  }
}

export const createHandler = new CreateHandler();
