// Re-export game event types from @mud/redis-client
import type { GameEvent } from '@mud/redis-client';
export type {
  BaseGameEvent,
  PlayerSpawnEvent,
  PlayerActivityEvent,
  PlayerDeathEvent,
  PlayerRespawnEvent,
  PlayerLevelUpEvent,
  PlayerJoinPartyEvent,
  PlayerLeavePartyEvent,
  CombatStartEvent,
  CombatHitEvent,
  CombatMissEvent,
  CombatEndEvent,
  CombatInitiateEvent,
  MonsterSpawnEvent,
  MonsterDeathEvent,
  NpcDialogueEvent,
  NpcQuestOfferEvent,
  PartyCreateEvent,
  PartyDisbandEvent,
  RunRoundEvent,
  RunEndEvent,
  GameEvent,
  GameEventType,
} from '@mud/redis-client';

export type EventListener<T extends GameEvent = GameEvent> = (
  event: T,
) => void | Promise<void>;
