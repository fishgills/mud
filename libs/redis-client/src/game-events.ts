/**
 * Game event types following RanvierMUD's event-driven pattern
 */

import { Player, Monster, Prisma, RunStatus, RunType } from '@mud/database';
import type {
  GuildAnnouncementPayload,
  GuildTradeResponse,
} from '@mud/api-contracts';

export interface BaseGameEvent {
  timestamp: Date;
  eventType: string;
}

export interface GuildShopReceiptEvent extends BaseGameEvent {
  eventType: 'guild.shop.receipt';
  receipt: GuildTradeResponse;
  correlationId?: string;
}

export interface GuildShopRefreshEvent extends BaseGameEvent {
  eventType: 'guild.shop.refresh';
  source: 'tick' | 'manual';
  items: number;
}

export interface GuildAnnouncementDeliveredEvent extends BaseGameEvent {
  eventType: 'guild.announcement.delivered';
  payload: GuildAnnouncementPayload;
  audience: 'guild' | 'global';
  correlationId?: string;
}

// Player Events
export interface PlayerSpawnEvent extends BaseGameEvent {
  eventType: 'player:spawn';
  player: Player;
}

export interface PlayerActivityEvent extends BaseGameEvent {
  eventType: 'player:activity';
  playerId: number;
  teamId?: string;
  userId?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface PlayerDeathEvent extends BaseGameEvent {
  eventType: 'player:death';
  player: Player;
  killedBy?: { type: 'player' | 'monster' | 'environment'; id?: number };
}

export interface PlayerRespawnEvent extends BaseGameEvent {
  eventType: 'player:respawn';
  player: Prisma.PlayerGetPayload<{ include: { slackUser: true } }>;
}

export interface PlayerLevelUpEvent extends BaseGameEvent {
  eventType: 'player:levelup';
  player: Player;
  newLevel: number;
  skillPointsGained: number;
}

export interface PlayerEquipmentEvent extends BaseGameEvent {
  eventType: 'player:equipment';
  playerId: number;
  teamId: string;
  userId: string;
  playerItemId: number;
  action: 'equip' | 'unequip';
  slot?: string | null;
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
  attacker: { type: 'player' | 'monster'; id: number; name: string };
  defender: { type: 'player' | 'monster'; id: number; name: string };
}

export interface CombatHitEvent extends BaseGameEvent {
  eventType: 'combat:hit';
  attacker: { type: 'player' | 'monster'; id: number; name: string };
  defender: { type: 'player' | 'monster'; id: number; name: string };
  damage: number;
}

export interface CombatMissEvent extends BaseGameEvent {
  eventType: 'combat:miss';
  attacker: { type: 'player' | 'monster'; id: number; name: string };
  defender: { type: 'player' | 'monster'; id: number; name: string };
}

export interface CombatEndEvent extends BaseGameEvent {
  eventType: 'combat:end';
  winner: { type: 'player' | 'monster'; id: number; name: string };
  loser: { type: 'player' | 'monster'; id: number; name: string };
  xpGained?: number;
  goldGained?: number;
}

export interface CombatInitiateEvent extends BaseGameEvent {
  eventType: 'combat:initiate';
  attacker: {
    type: 'player' | 'monster';
    id: number | string;
    name?: string;
  };
  defender: {
    type: 'player' | 'monster';
    id: number | string;
    name?: string;
  };
  metadata?: {
    source?: string;
    reason?: string;
  };
}

// Monster Events
export interface MonsterSpawnEvent extends BaseGameEvent {
  eventType: 'monster:spawn';
  monster: Monster;
}

export interface MonsterDeathEvent extends BaseGameEvent {
  eventType: 'monster:death';
  monster: Monster;
  killedBy?: { type: 'player' | 'monster'; id?: number };
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

// Run Events
export interface RunRoundEvent extends BaseGameEvent {
  eventType: 'run:round';
  runId: number;
  runType: RunType;
  round: number;
  bankedXp: number;
  bankedGold: number;
  leaderId: number;
  guildId?: number;
}

export interface RunEndEvent extends BaseGameEvent {
  eventType: 'run:end';
  runId: number;
  runType: RunType;
  status: RunStatus;
  bankedXp: number;
  bankedGold: number;
  leaderId: number;
  guildId?: number;
}

// Union type of all game events
export type GameEvent =
  | PlayerSpawnEvent
  | PlayerActivityEvent
  | PlayerDeathEvent
  | PlayerRespawnEvent
  | PlayerLevelUpEvent
  | PlayerEquipmentEvent
  | PlayerJoinPartyEvent
  | PlayerLeavePartyEvent
  | GuildShopRefreshEvent
  | CombatStartEvent
  | CombatHitEvent
  | CombatMissEvent
  | CombatEndEvent
  | CombatInitiateEvent
  | MonsterSpawnEvent
  | MonsterDeathEvent
  | NpcDialogueEvent
  | NpcQuestOfferEvent
  | PartyCreateEvent
  | PartyDisbandEvent
  | RunRoundEvent
  | RunEndEvent
  | GuildShopReceiptEvent
  | GuildAnnouncementDeliveredEvent;

export type GameEventType = GameEvent['eventType'];
