import {
  CreatePlayerDto,
  PlayerStatsDto,
  AttackDto,
} from './player.dto';

describe('Player DTOs', () => {
  describe('CreatePlayerDto', () => {
    it('should define a valid player creation DTO', () => {
      const dto: CreatePlayerDto = {
        userId: 'U123',
        teamId: 'T1',
        name: 'TestPlayer',
      };

      expect(dto.userId).toBe('U123');
      expect(dto.teamId).toBe('T1');
      expect(dto.name).toBe('TestPlayer');
    });

    it('should allow identifiers to be omitted', () => {
      const dto: CreatePlayerDto = {
        name: 'TestPlayer',
      };

      expect(dto.userId).toBeUndefined();
      expect(dto.teamId).toBeUndefined();
      expect(dto.name).toBe('TestPlayer');
    });
  });

  describe('PlayerStatsDto', () => {
    it('should define a valid stats DTO with all fields', () => {
      const dto: PlayerStatsDto = {
        hp: 100,
        xp: 500,
        gold: 250,
        level: 5,
      };

      expect(dto.hp).toBe(100);
      expect(dto.xp).toBe(500);
      expect(dto.gold).toBe(250);
      expect(dto.level).toBe(5);
    });

    it('should allow partial stats updates', () => {
      const dto: PlayerStatsDto = {
        hp: 75,
      };

      expect(dto.hp).toBe(75);
      expect(dto.xp).toBeUndefined();
      expect(dto.gold).toBeUndefined();
      expect(dto.level).toBeUndefined();
    });

    it('should allow empty DTO', () => {
      const dto: PlayerStatsDto = {};

      expect(dto.hp).toBeUndefined();
      expect(dto.xp).toBeUndefined();
      expect(dto.gold).toBeUndefined();
      expect(dto.level).toBeUndefined();
    });
  });

  describe('AttackDto', () => {
    it('should define a valid player attack DTO', () => {
      const dto: AttackDto = {
        targetType: 'player',
        targetId: 42,
      };

      expect(dto.targetType).toBe('player');
      expect(dto.targetId).toBe(42);
    });

    it('should define a valid monster attack DTO', () => {
      const dto: AttackDto = {
        targetType: 'monster',
        targetId: 13,
      };

      expect(dto.targetType).toBe('monster');
      expect(dto.targetId).toBe(13);
    });
  });
});
