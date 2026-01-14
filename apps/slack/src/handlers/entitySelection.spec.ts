import {
  buildMonsterOption,
  buildPlayerOption,
  decodePlayerSelection,
  encodePlayerSelection,
} from './entitySelection';
import type { NearbyPlayer, NearbyMonster } from './entitySelection';

describe('entitySelection helpers', () => {
  it('encodes and decodes player selections', () => {
    const encoded = encodePlayerSelection('T1', 'U2');
    expect(encoded).toBe('P:T1:U2');
    expect(decodePlayerSelection(encoded)).toEqual({
      teamId: 'T1',
      userId: 'U2',
    });
  });

  it('decodes legacy values that only contain a user id', () => {
    expect(decodePlayerSelection('P:U9')).toEqual({
      teamId: '',
      userId: 'U9',
    });
  });

  it('returns null for invalid selection strings', () => {
    expect(decodePlayerSelection('INVALID')).toBeNull();
    expect(decodePlayerSelection('P:')).toBeNull();
    expect(decodePlayerSelection('P:T1:')).toBeNull();
  });

  it('builds player options only when identity is available', () => {
    const validPlayer: NearbyPlayer = {
      name: 'Hero',
      userId: 'U1',
      teamId: 'T1',
    };
    expect(buildPlayerOption(validPlayer)).toEqual({
      text: { type: 'plain_text', text: 'Player: Hero', emoji: true },
      value: 'P:T1:U1',
    });

    const missingIdentity: NearbyPlayer = { name: 'Mystery' };
    expect(buildPlayerOption(missingIdentity)).toBeNull();
  });

  it('builds monster options when the id exists', () => {
    const monster: NearbyMonster = { id: '55', name: 'Goblin' };
    expect(buildMonsterOption(monster)).toEqual({
      text: { type: 'plain_text', text: 'Monster: Goblin', emoji: true },
      value: 'M:55',
    });
    expect(buildMonsterOption({ name: 'Ghost' } as NearbyMonster)).toBeNull();
  });
});
