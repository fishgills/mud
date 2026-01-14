import { COMMANDS } from '../commands';
import {
  formatSlackResponseMetadata,
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

    const message = getUserFriendlyErrorMessage(error, defaultMessage);
    expect(message).toContain('Player already exists');
    expect(message).toContain('"message":"Player with slackId U123 already exists"');
  });

  it('falls back to original error message when no better alternative exists', () => {
    const message = getUserFriendlyErrorMessage(
      new Error('unexpected input'),
      defaultMessage,
    );
    expect(message).toContain('unexpected input');
    expect(message).toContain('"message":"unexpected input"');
  });
});

describe('formatSlackResponseMetadata', () => {
  it('stringifies response metadata payloads', () => {
    const error = {
      data: { response_metadata: { acceptedScopes: ['chat:write'] } },
    };
    expect(formatSlackResponseMetadata(error)).toBe(
      JSON.stringify({ acceptedScopes: ['chat:write'] }),
    );
  });

  it('returns null when response metadata is missing', () => {
    expect(formatSlackResponseMetadata(new Error('nope'))).toBeNull();
  });
});
