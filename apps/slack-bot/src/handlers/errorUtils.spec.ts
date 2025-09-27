import { COMMANDS } from '../commands';
import {
  getUserFriendlyErrorMessage,
  handlePlayerNotFoundError,
} from './errorUtils';

describe('handlePlayerNotFoundError', () => {
  it('detects GraphQL not found errors', () => {
    const error = {
      response: {
        errors: [
          { message: 'Player not found', extensions: { code: 'NOT_FOUND' } },
        ],
      },
    };

    expect(handlePlayerNotFoundError(error)).toBe(
      `You don't have a character yet! Use "${COMMANDS.NEW} CharacterName" to create one.`,
    );
  });

  it('falls back to null when error is unrelated', () => {
    expect(handlePlayerNotFoundError(new Error('other failure'))).toBeNull();
  });
});

describe('getUserFriendlyErrorMessage', () => {
  const defaultMessage = 'Something went wrong';

  it('returns friendly message for player-not-found errors', () => {
    const error = new Error('Player not found');

    expect(getUserFriendlyErrorMessage(error, defaultMessage)).toBe(
      `You don't have a character yet! Use "${COMMANDS.NEW} CharacterName" to create one.`,
    );
  });

  it('scrubs sensitive slackId info from GraphQL errors', () => {
    const error = {
      response: {
        errors: [
          {
            message: 'Player with slackId U123 not found',
          },
        ],
      },
    };

    expect(getUserFriendlyErrorMessage(error, defaultMessage)).toBe(
      `You don't have a character yet! Use "${COMMANDS.NEW} CharacterName" to create one.`,
    );
  });

  it('sanitises regular error messages', () => {
    const error = new Error('Player with slackId U123 already exists');

    expect(getUserFriendlyErrorMessage(error, defaultMessage)).toBe(
      'Player already exists',
    );
  });

  it('returns default message when no better alternative exists', () => {
    expect(
      getUserFriendlyErrorMessage('unexpected input', defaultMessage),
    ).toBe(defaultMessage);
  });
});
