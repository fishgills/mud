import { COMMANDS } from '../commands';
import {
  getUserFriendlyErrorMessage,
  handlePlayerNotFoundError,
} from './errorUtils';

describe('handlePlayerNotFoundError', () => {
  it('detects not found errors in message', () => {
    const error = new Error('Player not found');

    expect(handlePlayerNotFoundError(error)).toBe(
      `You don't have a character yet! Use \`${COMMANDS.NEW} CharacterName\` to create one.`,
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
      `You don't have a character yet! Use \`${COMMANDS.NEW} CharacterName\` to create one.`,
    );
  });

  it('sanitises messages containing slackIds', () => {
    const error = new Error('Player with slackId U123 already exists');

    expect(getUserFriendlyErrorMessage(error, defaultMessage)).toBe(
      'Player already exists',
    );
  });

  it('falls back to original error message when no better alternative exists', () => {
    expect(
      getUserFriendlyErrorMessage(
        new Error('unexpected input'),
        defaultMessage,
      ),
    ).toBe('unexpected input');
  });
});
