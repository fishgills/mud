import { EntityToDtoAdapter } from './entity-to-dto.adapter';

describe('EntityToDtoAdapter', () => {
  test('parses client identifiers and normalizes slack ids', () => {
    const e = {
      id: '5',
      clientId: 'slack:slack:U123',
      slackId: 'slack:U123',
      name: 'Tester',
      position: { x: '2', y: 3 },
      combat: { hp: '8', maxHp: '10', isAlive: true },
      attributes: { strength: '4', agility: 5, health: '6' },
      gold: '12',
      xp: '34',
      level: '2',
      skillPoints: '1',
      createdAt: '2020-01-01T00:00:00.000Z',
      updatedAt: 1577836800000,
    } as any;

    const dto = EntityToDtoAdapter.playerEntityToDto(e);
    expect(dto.id).toBe(5);
    expect(dto.clientType).toBe('slack');
    expect(dto.clientId).toContain('slack:');
    expect(dto.slackId).toBe('U123');
    expect(dto.name).toBe('Tester');
    expect(dto.x).toBe(2);
    expect(dto.y).toBe(3);
    expect(dto.hp).toBe(8);
    expect(dto.maxHp).toBe(10);
    expect(dto.strength).toBe(4);
    expect(dto.agility).toBe(5);
    expect(dto.health).toBe(6);
    expect(dto.gold).toBe(12);
    expect(dto.xp).toBe(34);
    expect(dto.level).toBe(2);
    expect(dto.skillPoints).toBe(1);
    expect(dto.createdAt).toBeInstanceOf(Date);
    expect(dto.updatedAt).toBeInstanceOf(Date);
  });

  test('handles missing client info and defaults', () => {
    const e = {
      id: 1,
      name: '',
      position: {},
      combat: {},
      attributes: {},
    } as any;

    const dto = EntityToDtoAdapter.playerEntityToDto(e);
    expect(dto.name).toBe('Unknown Adventurer');
    expect(dto.clientType).toBe('web');
    expect(dto.clientId).toContain('web:');
    expect(dto.slackId).toBeNull();
    expect(dto.hp).toBe(0);
    expect(dto.maxHp).toBe(0);
  });

  test('maps equipped playerItems into equipment slots', () => {
    const e = {
      id: 7,
      playerItems: [
        {
          equipped: true,
          slot: 'head',
          itemId: '11',
          quality: 'Rare',
          item: { slot: 'head' },
        },
        {
          equipped: true,
          itemId: 12,
          quality: 'Common',
          item: { type: 'weapon' },
        },
        {
          equipped: true,
          slot: 'chest',
          itemId: '13',
          quality: 'Uncommon',
          item: { slot: 'chest' },
        },
      ],
    } as any;

    const dto = EntityToDtoAdapter.playerEntityToDto(e);
    expect(dto.equipment.head).toEqual({ id: 11, quality: 'Rare' });
    expect(dto.equipment.weapon).toEqual({ id: 12, quality: 'Common' });
    expect(dto.equipment.chest).toEqual({ id: 13, quality: 'Uncommon' });
  });

  test('toNumberOrNull and date parsing via monster mapping', () => {
    const m = {
      id: '9',
      name: '',
      type: null,
      position: { x: '4', y: '5' },
      combat: { hp: '3' },
      attributes: { strength: '2', agility: '1', health: '7' },
      lastMove: '2020-01-01T00:00:00.000Z',
      spawnedAt: 1577836800000,
      createdAt: undefined,
      updatedAt: null,
      worldTileId: null,
      biomeId: '12',
    } as any;

    const dto = EntityToDtoAdapter.monsterEntityToDto(m);
    expect(dto.id).toBe(9);
    expect(dto.name).toBe('Unknown Monster');
    expect(dto.type).toBe('unknown');
    expect(dto.hp).toBe(3);
    expect(dto.x).toBe(4);
    expect(dto.y).toBe(5);
    expect(dto.lastMove).toBeInstanceOf(Date);
    expect(dto.spawnedAt).toBeInstanceOf(Date);
    expect(dto.createdAt).toBeInstanceOf(Date);
    expect(dto.updatedAt).toBeInstanceOf(Date);
    expect(dto.biomeId).toBe(12);
    expect(dto.worldTileId).toBeUndefined();
  });

  test('arrays to dto helpers handle empty arrays', () => {
    const players = EntityToDtoAdapter.playerEntitiesToDto([]);
    const monsters = EntityToDtoAdapter.monsterEntitiesToDto([]);
    expect(Array.isArray(players)).toBe(true);
    expect(players.length).toBe(0);
    expect(Array.isArray(monsters)).toBe(true);
    expect(monsters.length).toBe(0);
  });
});
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
          quality: 'Uncommon',
          item: { id: 77, slot: 'chest', type: 'armor' },
        },
      ],
    };

    const dto = EntityToDtoAdapter.playerEntityToDto(raw as unknown as Player);
    expect(dto.equipment?.chest).toEqual({ id: 77, quality: 'Uncommon' });
  });
});
