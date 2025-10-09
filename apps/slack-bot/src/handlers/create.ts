import { HandlerContext } from './types';
import { COMMANDS } from '../commands';
import { buildPlayerStatsMessage } from './stats/format';
import { PlayerCommandHandler } from './base';

export const createHandlerHelp = `Create a new character with "new". Example: Send "new AwesomeDude" to create a character named AwesomeDude.`;

export class CreateHandler extends PlayerCommandHandler {
  constructor() {
    super(COMMANDS.NEW, 'Failed to create character');
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
        text: `Please provide a name for your character! Example: "new AwesomeDude"`,
      });
      return;
    }

    const input = {
      slackId: this.toClientId(userId),
      name,
    };

    try {
      const result = await this.sdk.CreatePlayer({ input });
      if (result.createPlayer.success && result.createPlayer.data) {
        const introText = `Welcome <@${userId}>! Your character creation has started.`;
        const instructions =
          'Use "reroll" to reroll your stats, and "complete" when you are done.';
        const statsMessage = buildPlayerStatsMessage(result.createPlayer.data, {
          isSelf: true,
        });
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

      console.log('CreatePlayer error:', result.createPlayer);
      await say({ text: `Error: ${result.createPlayer.message}` });
    } catch (err: unknown) {
      if (
        err &&
        typeof err === 'object' &&
        'response' in err &&
        err.response &&
        typeof err.response === 'object' &&
        'errors' in err.response
      ) {
        const errors = err.response.errors as Array<{
          extensions?: { code?: string };
          message: string;
        }>;
        const playerExists = errors.find(
          (e) => e.extensions?.code === 'PLAYER_EXISTS',
        );
        if (playerExists) {
          await say({ text: `You already have a character!` });
          return;
        }
      }

      throw err;
    }
  }
}

export const createHandler = new CreateHandler();
