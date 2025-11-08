import { COMMANDS } from '../commands';
import type { HandlerContext } from './types';
import type { PlayerRecord } from '../dm-client';
import { dmClient } from '../dm-client';

/**
 * Friendly message shown when a user doesn't have a character yet
 */
export const MISSING_CHARACTER_MESSAGE = `You don't have a character yet! Use "${COMMANDS.NEW} CharacterName" to create one.`;

/**
 * Requires a character to exist for the current user.
 * If the character doesn't exist, sends a friendly message and returns null.
 *
 * @param teamId The Slack team/workspace ID
 * @param userId The Slack user ID
 * @param say Function to send messages back to the user
 * @param customErrorMessage Optional custom message to send if character is missing
 * @returns The PlayerRecord if found, or null if not found
 */
export async function requireCharacter(
  teamId: string,
  userId: string,
  say: HandlerContext['say'],
  customErrorMessage?: string,
): Promise<PlayerRecord | null> {
  const result = await dmClient.getPlayer({
    teamId,
    userId,
  });

  const player = result.data;

  if (!player) {
    const message =
      customErrorMessage || result.message || MISSING_CHARACTER_MESSAGE;
    await say({ text: message });
    return null;
  }

  return player;
}
