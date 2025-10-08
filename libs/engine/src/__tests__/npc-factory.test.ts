import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { NpcFactory } from '../factories/npc-factory';

describe('NpcFactory', () => {
  beforeEach(() => {
    NpcFactory.clear();
  });

  afterEach(() => {
    NpcFactory.clear();
  });

  it('creates NPCs with role-appropriate stats and stores them', () => {
    const npc = NpcFactory.create({
      name: 'Guard Thomas',
      role: 'guard',
      x: 10,
      y: 5,
      settlementId: 2,
      dialogue: 'Stay vigilant.',
      isHostile: false,
    });

    expect(npc.id).toBe(1);
    expect(npc.role).toBe('guard');
    expect(npc.attributes.strength).toBeGreaterThan(10);
    expect(NpcFactory.load(npc.id)?.name).toBe('Guard Thomas');
  });

  it('loads NPCs by location and settlement', () => {
    const a = NpcFactory.create({
      name: 'Merchant A',
      role: 'merchant',
      x: 0,
      y: 0,
      settlementId: 1,
    });
    const b = NpcFactory.create({
      name: 'Citizen B',
      role: 'citizen',
      x: 0,
      y: 0,
      settlementId: 2,
    });

    expect(NpcFactory.loadAtLocation(0, 0)).toHaveLength(2);
    expect(NpcFactory.loadInSettlement(1)).toEqual([a]);
    expect(NpcFactory.loadInSettlement(2)).toEqual([b]);
  });

  it('deletes and clears NPCs', () => {
    const npc = NpcFactory.create({
      name: 'Temp',
      role: 'citizen',
      x: 1,
      y: 1,
    });

    expect(NpcFactory.delete(npc.id)).toBe(true);
    expect(NpcFactory.load(npc.id)).toBeNull();

    NpcFactory.clear();
    expect(NpcFactory.loadAtLocation(1, 1)).toEqual([]);
  });

  it('supports quest givers and innkeepers with tailored stats', () => {
    const questGiver = NpcFactory.create({
      name: 'Elder Rowan',
      role: 'quest_giver',
      x: 3,
      y: 3,
    });

    const innkeeper = NpcFactory.create({
      name: 'Innkeep Mira',
      role: 'innkeeper',
      x: 4,
      y: 1,
      isHostile: true,
    });

    expect(questGiver.canOfferQuests()).toBe(true);
    expect(questGiver.attributes.health).toBe(12);
    expect(questGiver.combat.maxHp).toBe(34);
    expect(questGiver.getGreeting()).toContain('task for you');

    expect(innkeeper.attributes.agility).toBe(8);
    expect(innkeeper.combat.maxHp).toBe(34);
    expect(innkeeper.isHostile).toBe(true);
    expect(innkeeper.getGreeting()).toContain('Rest and recover');
  });
});
