/**
 * Game event types following RanvierMUD's event-driven pattern
 */

import { Player, Monster } from '@mud/database';

export interface BaseGameEvent {
  timestamp: Date;
  eventType: string;
}

// Player Events
export interface PlayerSpawnEvent extends BaseGameEvent {
  eventType: 'player:spawn';
  player: Player;
  x: number;
  y: number;
}

export interface PlayerMoveEvent extends BaseGameEvent {
  eventType: 'player:move';
  player: Player;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  direction?: string;
}

export interface PlayerDeathEvent extends BaseGameEvent {
  eventType: 'player:death';
  player: Player;
  killedBy?: { type: 'player' | 'monster' | 'environment'; id?: number };
}

export interface PlayerRespawnEvent extends BaseGameEvent {
  eventType: 'player:respawn';
  player: Player;
  x: number;
  y: number;
}

export interface PlayerLevelUpEvent extends BaseGameEvent {
  eventType: 'player:levelup';
  player: Player;
  newLevel: number;
  skillPointsGained: number;
}

export interface PlayerJoinPartyEvent extends BaseGameEvent {
  eventType: 'player:party:join';
  player: Player;
  partyId: number;
}

export interface PlayerLeavePartyEvent extends BaseGameEvent {
  eventType: 'player:party:leave';
  player: Player;
  partyId: number;
}

// Combat Events
export interface CombatStartEvent extends BaseGameEvent {
  eventType: 'combat:start';
  attacker: { type: 'player' | 'monster'; id: number };
  defender: { type: 'player' | 'monster'; id: number };
  x: number;
  y: number;
}

export interface CombatHitEvent extends BaseGameEvent {
  eventType: 'combat:hit';
  attacker: { type: 'player' | 'monster'; id: number; name: string };
  defender: { type: 'player' | 'monster'; id: number; name: string };
  damage: number;
  x: number;
  y: number;
}

export interface CombatMissEvent extends BaseGameEvent {
  eventType: 'combat:miss';
  attacker: { type: 'player' | 'monster'; id: number; name: string };
  defender: { type: 'player' | 'monster'; id: number; name: string };
}

export interface CombatEndEvent extends BaseGameEvent {
  eventType: 'combat:end';
  winner: { type: 'player' | 'monster'; id: number };
  loser: { type: 'player' | 'monster'; id: number };
  xpGained?: number;
  goldGained?: number;
}

// Monster Events
export interface MonsterSpawnEvent extends BaseGameEvent {
  eventType: 'monster:spawn';
  monster: Monster;
  x: number;
  y: number;
}

export interface MonsterMoveEvent extends BaseGameEvent {
  eventType: 'monster:move';
  monster: Monster;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

export interface MonsterDeathEvent extends BaseGameEvent {
  eventType: 'monster:death';
  monster: Monster;
  killedBy?: { type: 'player' | 'monster'; id: number };
}

// NPC Events
export interface NpcDialogueEvent extends BaseGameEvent {
  eventType: 'npc:dialogue';
  npcId: number;
  playerId: number;
  dialogue: string;
}

export interface NpcQuestOfferEvent extends BaseGameEvent {
  eventType: 'npc:quest:offer';
  npcId: number;
  playerId: number;
  questId: number;
}

// Party Events
export interface PartyCreateEvent extends BaseGameEvent {
  eventType: 'party:create';
  partyId: number;
  leaderId: number;
  leaderName: string;
}

export interface PartyDisbandEvent extends BaseGameEvent {
  eventType: 'party:disband';
  partyId: number;
}

// World Events
export interface WeatherChangeEvent extends BaseGameEvent {
  eventType: 'world:weather:change';
  oldWeather: string;
  newWeather: string;
}

export interface TimeTickEvent extends BaseGameEvent {
  eventType: 'world:time:tick';
  tick: number;
  gameHour: number;
  gameDay: number;
}

// Union type of all game events
export type GameEvent =
  | PlayerSpawnEvent
  | PlayerMoveEvent
  | PlayerDeathEvent
  | PlayerRespawnEvent
  | PlayerLevelUpEvent
  | PlayerJoinPartyEvent
  | PlayerLeavePartyEvent
  | CombatStartEvent
  | CombatHitEvent
  | CombatMissEvent
  | CombatEndEvent
  | MonsterSpawnEvent
  | MonsterMoveEvent
  | MonsterDeathEvent
  | NpcDialogueEvent
  | NpcQuestOfferEvent
  | PartyCreateEvent
  | PartyDisbandEvent
  | WeatherChangeEvent
  | TimeTickEvent;

export type GameEventType = GameEvent['eventType'];

export type EventListener<T extends GameEvent = GameEvent> = (
  event: T,
) => void | Promise<void>;
