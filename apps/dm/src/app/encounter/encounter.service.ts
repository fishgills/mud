import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventBus, type PlayerMoveEvent } from '@mud/engine';
import type { Monster } from '@mud/database';
import { MonsterService } from '../monster/monster.service';
import { CombatService } from '../combat/combat.service';

@Injectable()
export class EncounterService implements OnModuleInit {
  constructor(
    private monsterService: MonsterService,
    private combatService: CombatService,
  ) {}

  onModuleInit() {
    // Subscribe to player:move events when the module initializes
    EventBus.on('player:move', this.handlePlayerMove.bind(this));
  }

  /**
   * Handle player movement and check for monster encounters
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
        return; // No monsters, no encounter
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

      // Emit monster:encounter event
      await EventBus.emit({
        eventType: 'monster:encounter',
        player,
        monsters: monsterData,
        x: toX,
        y: toY,
        timestamp: new Date(),
      });

      // For each monster, calculate chance of attack based on agility
      for (const monster of monsters) {
        const attackChance = this.calculateAttackChance(
          monster.attributes.agility,
        );
        const roll = Math.random() * 100;

        const shouldAttack = roll < attackChance;
        console.debug('Monster attack chance evaluated', {
          monsterId: monster.id,
          attackChance,
          roll,
          shouldAttack,
        });

        if (shouldAttack) {
          console.debug('Monster attack condition met', {
            monsterId: monster.id,
          });
          if (!player.slackId) {
            console.error(
              `Cannot trigger monster attack: Player ${player.name} has no slackId`,
            );
            continue;
          }
          await this.combatService.monsterAttackPlayer(
            monster.id,
            player.slackId,
          );
        }
      }
    } catch (error) {
      console.error('Error handling monster encounter:', error);
    }
  }

  /**
   * Calculate the percentage chance a monster will attack based on its agility
   * Higher agility = more likely to attack
   * @param agility Monster's agility stat
   * @returns Percentage chance (0-100)
   */
  private calculateAttackChance(agility: number): number {
    // Base formula: agility * 5, capped at 95% to never be certain
    // Examples:
    // - agility 5 = 25% chance
    // - agility 10 = 50% chance
    // - agility 15 = 75% chance
    // - agility 19+ = 95% chance (capped)
    return Math.min(95, agility * 5);
  }
}
