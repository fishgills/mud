import { describe, expect, it, jest } from '@jest/globals';

import { MonsterEntity } from '../entities/monster-entity';
import { PlayerEntity } from '../entities/player-entity';
import { NpcEntity } from '../entities/npc-entity';
import { PartyEntity } from '../entities/party-entity';

const createMonster = () =>
  new MonsterEntity({
    id: 1,
    name: 'Goblin',
    type: 'humanoid',
    attributes: { strength: 8, agility: 10, health: 9 },
    combat: { hp: 20, maxHp: 20, isAlive: true },
    position: { x: 0, y: 0 },
    biomeId: 1,
    spawnedAt: new Date('2024-01-01T00:00:00Z'),
  });

const createPlayer = () =>
  new PlayerEntity({
    id: 1,
    clientId: 'U123',
    clientType: 'slack',
    name: 'Hero',
    attributes: { strength: 12, agility: 11, health: 12 },
    combat: { hp: 30, maxHp: 30, isAlive: true },
    position: { x: 0, y: 0 },
    gold: 5,
    xp: 90,
    level: 2,
    skillPoints: 2,
    partyId: undefined,
  });

const createNpc = () =>
  new NpcEntity({
    id: 2,
    name: 'Merchant',
    role: 'merchant',
    attributes: { strength: 8, agility: 10, health: 10 },
    combat: { hp: 20, maxHp: 20, isAlive: true },
    position: { x: 5, y: 5 },
    settlementId: 3,
    dialogue: 'Buy something?',
    isHostile: false,
  });

describe('Character and MonsterEntity', () => {
  it('calculates combat stats and handles damage and healing', () => {
    const monster = createMonster();

    expect(monster.getAttackPower()).toBe(17);
    expect(monster.getDefense()).toBe(12);

    const damage = monster.takeDamage(5);
    expect(damage).toBe(5);
    expect(monster.combat.hp).toBe(15);
    expect(monster.isAlive()).toBe(true);

    const healAmount = monster.heal(10);
    expect(healAmount).toBe(5);
    expect(monster.combat.hp).toBe(20);

    monster.takeDamage(25);
    expect(monster.combat.isAlive).toBe(false);
    expect(monster.isAlive()).toBe(false);
  });

  it('moves, measures distance, and serializes correctly', () => {
    const monster = createMonster();
    monster.moveTo(3, 4);
    expect(monster.position).toEqual({ x: 3, y: 4 });
    expect(monster.distanceTo(0, 0)).toBe(5);

    const json = monster.toJSON();
    expect(json).toMatchObject({
      id: 1,
      name: 'Goblin',
      type: 'humanoid',
      biomeId: 1,
    });
    expect(monster.getEntityType()).toBe('monster');
  });

  it('calculates rewards and movement timing', () => {
    const monster = createMonster();
    jest.spyOn(Math, 'random').mockReturnValue(0.4);

    expect(monster.getXpReward()).toBe(54);
    expect(monster.getGoldReward()).toBe(12);

    monster.lastMove = new Date(Date.now() - 40_000);
    expect(monster.shouldMove(30)).toBe(true);
    monster.updateLastMove();
    expect(monster.shouldMove(30)).toBe(false);
  });
});

describe('PlayerEntity', () => {
  it('awards XP and gold, levels up, and manages skill points', () => {
    const player = createPlayer();

    expect(player.getXpForNextLevel()).toBe(200);
    expect(player.awardXp(120)).toBe(true);

    player.levelUp();
    expect(player.level).toBe(3);
    expect(player.combat.maxHp).toBeGreaterThan(30);

    expect(player.spendSkillPoint('strength')).toBe(true);
    expect(player.attributes.strength).toBe(13);
    expect(player.skillPoints).toBe(1);

    expect(player.spendSkillPoint('strength')).toBe(true);
    expect(player.skillPoints).toBe(0);
    expect(player.spendSkillPoint('strength')).toBe(false);

    player.awardGold(10);
    expect(player.gold).toBe(15);

    expect(player.isInParty()).toBe(false);
    player.partyId = 123;
    expect(player.isInParty()).toBe(true);

    const json = player.toJSON();
    expect(json).toMatchObject({
      name: 'Hero',
      clientId: 'U123',
      type: 'player',
    });
  });
});

describe('NpcEntity', () => {
  it('provides role-specific helpers and greetings', () => {
    const npc = createNpc();

    expect(npc.isMerchant()).toBe(true);
    expect(npc.canOfferQuests()).toBe(false);
    expect(npc.isInSettlement()).toBe(true);

    npc.setDialogue('New goods!');
    expect(npc.dialogue).toBe('New goods!');

    expect(npc.getGreeting()).toContain('Welcome, traveler');
  });
});

describe('PartyEntity', () => {
  const createParty = () =>
    new PartyEntity({
      id: 1,
      name: 'Adventurers',
      leaderId: 10,
      members: [
        {
          playerId: 10,
          playerName: 'Leader',
          isLeader: true,
          joinedAt: new Date('2024-01-01T00:00:00Z'),
        },
      ],
      createdAt: new Date('2024-01-01T00:00:00Z'),
      maxSize: 3,
    });

  it('manages members and leadership', () => {
    const party = createParty();

    expect(party.getLeader()?.playerName).toBe('Leader');
    expect(party.hasMember(10)).toBe(true);
    expect(party.isLeader(10)).toBe(true);
    expect(party.isFull()).toBe(false);

    expect(party.addMember(11, 'Rogue')).toBe(true);
    expect(party.getSize()).toBe(2);
    expect(party.addMember(11, 'Duplicate')).toBe(false);

    expect(party.transferLeadership(11)).toBe(true);
    expect(party.leaderId).toBe(11);

    expect(party.removeMember(11)).toBe(false); // cannot remove leader
    expect(party.transferLeadership(10)).toBe(true);
    expect(party.removeMember(11)).toBe(true);
  });

  it('serializes party data', () => {
    const party = createParty();
    const json = party.toJSON();

    expect(json).toMatchObject({
      type: 'party',
      currentSize: 1,
      leaderId: 10,
    });
  });
});
