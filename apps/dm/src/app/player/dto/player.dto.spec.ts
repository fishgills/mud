import {
  CreatePlayerDto,
  MovePlayerDto,
  PlayerStatsDto,
  AttackDto,
} from './player.dto';

describe('Player DTOs', () => {
  describe('CreatePlayerDto', () => {
    it('should define a valid player creation DTO', () => {
      const dto: CreatePlayerDto = {
        slackId: 'U123',
        name: 'TestPlayer',
      };

      expect(dto.slackId).toBe('U123');
      expect(dto.name).toBe('TestPlayer');
      expect(dto.x).toBeUndefined();
      expect(dto.y).toBeUndefined();
    });

    it('should allow optional coordinates', () => {
      const dto: CreatePlayerDto = {
        slackId: 'U123',
        name: 'TestPlayer',
        x: 10,
        y: 20,
      };

      expect(dto.x).toBe(10);
      expect(dto.y).toBe(20);
    });
  });

  describe('MovePlayerDto', () => {
    it('should define a valid move DTO with direction', () => {
      const dto: MovePlayerDto = {
        direction: 'north',
      };

      expect(dto.direction).toBe('north');
      expect(dto.x).toBeUndefined();
      expect(dto.y).toBeUndefined();
    });

    it('should define a valid move DTO with coordinates', () => {
      const dto: MovePlayerDto = {
        x: 15,
        y: 25,
      };

      expect(dto.x).toBe(15);
      expect(dto.y).toBe(25);
      expect(dto.direction).toBeUndefined();
    });

    it('should allow empty DTO', () => {
      const dto: MovePlayerDto = {};

      expect(dto.direction).toBeUndefined();
      expect(dto.x).toBeUndefined();
      expect(dto.y).toBeUndefined();
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
