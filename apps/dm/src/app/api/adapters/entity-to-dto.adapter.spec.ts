import { describe, it, expect } from '@jest/globals';
import { EntityToDtoAdapter } from './entity-to-dto.adapter';
import type { Player } from '@prisma/client';

describe('EntityToDtoAdapter.playerEntityToDto', () => {
  it('prefers item.slot when playerItem.slot is missing', () => {
    const raw = {
      id: 55,
      clientId: 'slack:U55',
      clientType: 'slack',
      slackId: 'U55',
      name: 'Adapter',
      x: 0,
      y: 0,
      hp: 10,
      maxHp: 10,
      playerItems: [
        {
          id: 200,
          itemId: 77,
          equipped: true,
          slot: null,
          item: { id: 77, slot: 'chest', type: 'armor' },
        },
      ],
    };

    const dto = EntityToDtoAdapter.playerEntityToDto(raw as unknown as Player);
    expect(dto.equipment?.chest).toBe(77);
  });
});
