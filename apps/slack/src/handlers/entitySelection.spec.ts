import {
  buildItemOption,
  buildMonsterOption,
  buildPlayerOption,
  decodePlayerSelection,
  encodePlayerSelection,
} from './entitySelection';
import type { NearbyPlayer, NearbyMonster, NearbyItem } from './locationUtils';

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
      id: 1,
      name: 'Hero',
      userId: 'U1',
      teamId: 'T1',
    };
    expect(buildPlayerOption(validPlayer)).toEqual({
      text: { type: 'plain_text', text: 'Player: Hero', emoji: true },
      value: 'P:T1:U1',
    });

    const missingIdentity: NearbyPlayer = { id: 2, name: 'Mystery' };
    expect(buildPlayerOption(missingIdentity)).toBeNull();
  });

  it('builds monster options when the id exists', () => {
    const monster: NearbyMonster = { id: 55, name: 'Goblin', hp: 10 };
    expect(buildMonsterOption(monster)).toEqual({
      text: { type: 'plain_text', text: 'Monster: Goblin', emoji: true },
      value: 'M:55',
    });
    expect(buildMonsterOption({ name: 'Ghost' } as NearbyMonster)).toBeNull();
  });

  it('creates descriptive item options including quality and quantity', () => {
    const item: NearbyItem = {
      id: 90,
      itemId: 5,
      itemName: 'Potion',
      quality: 'Rare',
      quantity: 3,
    };
    expect(buildItemOption(item)).toEqual({
      text: {
        type: 'plain_text',
        text: 'Item: Potion (Rare) x3',
        emoji: true,
      },
      value: 'I:90|5',
    });
    expect(buildItemOption({ itemName: 'Broken' } as NearbyItem)).toBeNull();
  });
});
