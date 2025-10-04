import { normalizeSlackId } from './slack-id.util';

describe('normalizeSlackId', () => {
  it('should remove slack: prefix when present', () => {
    expect(normalizeSlackId('slack:U123')).toBe('U123');
    expect(normalizeSlackId('slack:U456ABC')).toBe('U456ABC');
    expect(normalizeSlackId('slack:W789XYZ')).toBe('W789XYZ');
  });

  it('should return unchanged ID when no prefix present', () => {
    expect(normalizeSlackId('U123')).toBe('U123');
    expect(normalizeSlackId('U456ABC')).toBe('U456ABC');
    expect(normalizeSlackId('W789XYZ')).toBe('W789XYZ');
  });

  it('should handle empty string', () => {
    expect(normalizeSlackId('')).toBe('');
  });

  it('should handle slack: prefix with no ID', () => {
    expect(normalizeSlackId('slack:')).toBe('');
  });

  it('should only remove the prefix once', () => {
    expect(normalizeSlackId('slack:slack:U123')).toBe('slack:U123');
  });
});
