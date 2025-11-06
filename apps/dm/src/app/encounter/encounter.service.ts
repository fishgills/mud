import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventBus, type PlayerMoveEvent } from '@mud/engine';
import type { Monster } from '@mud/database';
import { MonsterService } from '../monster/monster.service';

@Injectable()
export class EncounterService implements OnModuleInit {
  constructor(private monsterService: MonsterService) {}

  onModuleInit() {
    // Subscribe to player:move events when the module initializes
    EventBus.on('player:move', this.handlePlayerMove.bind(this));
  }

  /**
   * Handle player movement and notify of nearby monsters
   * Note: No automatic combat is triggered. Players must manually initiate attacks.
   */
  private async handlePlayerMove(event: PlayerMoveEvent): Promise<void> {
    const { player, toX, toY } = event;

    try {
      // Check if there are any monsters at the player's new location
      const monsters = await this.monsterService.getMonstersAtLocation(
        toX,
        toY,
      );

      if (monsters.length === 0) {
        return; // No monsters present
      }

      // Convert entities to JSON for event emission
      const monsterData: Monster[] = monsters.map((m) => {
        const json = m.toJSON();
        return {
          id: m.id,
          name: m.name,
          x: m.position.x,
          y: m.position.y,
          hp: m.combat.hp,
          maxHp: m.combat.maxHp,
          strength: m.attributes.strength,
          agility: m.attributes.agility,
          health: m.attributes.health,
          isAlive: m.combat.isAlive,
          createdAt: new Date(json.createdAt as string),
          updatedAt: new Date(json.updatedAt as string),
          type: m.type,
          lastMove: m.lastMove,
          spawnedAt: m.spawnedAt,
          biomeId: m.biomeId,
        };
      });

      // Emit monster:encounter event for notification purposes
      await EventBus.emit({
        eventType: 'monster:encounter',
        player,
        monsters: monsterData,
        x: toX,
        y: toY,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Error handling monster encounter event:', error);
    }
  }
}
