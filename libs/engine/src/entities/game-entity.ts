/**
 * Base class for all game entities
 * Inspired by RanvierMUD's GameEntity pattern
 */

export abstract class GameEntity {
  public readonly id: number;
  public name: string;

  constructor(id: number, name: string) {
    this.id = id;
    this.name = name;
  }

  /**
   * Serialize entity to JSON
   */
  abstract toJSON(): Record<string, unknown>;

  /**
   * Get entity type for logging/debugging
   */
  abstract getEntityType(): string;
}
