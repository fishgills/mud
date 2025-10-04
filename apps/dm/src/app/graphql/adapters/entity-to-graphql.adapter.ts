/**
 * Adapters to convert engine entities to GraphQL models
 */

import { PlayerEntity, MonsterEntity } from '@mud/engine';
import { Player } from '../models/player.model';
import { Monster } from '../models/monster.model';

export class EntityToGraphQLAdapter {
  /**
   * Convert PlayerEntity to GraphQL Player model
   */
  static playerEntityToGraphQL(entity: PlayerEntity): Player {
    return {
      id: entity.id,
      clientId: `${entity.clientType}:${entity.clientId}`,
      clientType: entity.clientType,
      slackId: entity.clientType === 'slack' ? entity.clientId : null,
      name: entity.name,
      x: entity.position.x,
      y: entity.position.y,
      hp: entity.combat.hp,
      maxHp: entity.combat.maxHp,
      strength: entity.attributes.strength,
      agility: entity.attributes.agility,
      health: entity.attributes.health,
      gold: entity.gold,
      xp: entity.xp,
      level: entity.level,
      skillPoints: entity.skillPoints,
      isAlive: entity.combat.isAlive,
      lastAction: undefined, // TODO: Add to entity if needed
      createdAt: undefined, // TODO: Add to entity if needed
      updatedAt: new Date(),
      worldTileId: null,
    };
  }

  /**
   * Convert MonsterEntity to GraphQL Monster model
   */
  static monsterEntityToGraphQL(entity: MonsterEntity): Monster {
    return {
      id: entity.id,
      name: entity.name,
      type: entity.type,
      hp: entity.combat.hp,
      maxHp: entity.combat.maxHp,
      strength: entity.attributes.strength,
      agility: entity.attributes.agility,
      health: entity.attributes.health,
      x: entity.position.x,
      y: entity.position.y,
      isAlive: entity.combat.isAlive,
      lastMove: entity.lastMove,
      spawnedAt: entity.spawnedAt,
      biomeId: entity.biomeId,
      worldTileId: undefined,
      createdAt: entity.spawnedAt,
      updatedAt: new Date(),
    };
  }

  /**
   * Convert array of PlayerEntity to GraphQL Player models
   */
  static playerEntitiesToGraphQL(entities: PlayerEntity[]): Player[] {
    return entities.map((entity) => this.playerEntityToGraphQL(entity));
  }

  /**
   * Convert array of MonsterEntity to GraphQL Monster models
   */
  static monsterEntitiesToGraphQL(entities: MonsterEntity[]): Monster[] {
    return entities.map((entity) => this.monsterEntityToGraphQL(entity));
  }
}
