import { Test, TestingModule } from '@nestjs/testing';
import { EncounterService } from './encounter.service';
import { MonsterService } from '../monster/monster.service';
import { CombatService } from '../combat/combat.service';
import { EventBus } from '@mud/engine';
import type { PlayerMoveEvent } from '@mud/engine';

// Mock database package
jest.mock('@mud/database', () => ({
  getPrismaClient: jest.fn(),
}));

// Mock EventBus
jest.mock('@mud/engine', () => ({
  EventBus: {
    on: jest.fn(),
    emit: jest.fn(),
  },
}));

describe('EncounterService', () => {
  let service: EncounterService;
  let monsterService: jest.Mocked<MonsterService>;
  let combatService: jest.Mocked<CombatService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncounterService,
        {
          provide: MonsterService,
          useValue: {
            getMonstersAtLocation: jest.fn(),
          },
        },
        {
          provide: CombatService,
          useValue: {
            monsterAttackPlayer: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EncounterService>(EncounterService);
    monsterService = module.get(MonsterService);
    combatService = module.get(CombatService);

    // Clear mock calls from onModuleInit
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should register player:move event listener', () => {
      service.onModuleInit();
      expect(EventBus.on).toHaveBeenCalledWith(
        'player:move',
        expect.any(Function),
      );
    });
  });

  describe('handlePlayerMove', () => {
    const mockPlayer = {
      id: 1,
      slackId: 'U123456',
      name: 'TestPlayer',
      x: 10,
      y: 20,
      hp: 100,
      maxHp: 100,
      strength: 10,
      agility: 10,
      health: 10,
      gold: 0,
      xp: 0,
      level: 1,
      isAlive: true,
      clientId: 'slack:U123456',
      clientType: 'slack',
      skillPoints: 0,
      lastAction: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      worldTileId: null,
      partyId: null,
    };

    const createMockMonster = (id: number, agility: number) => ({
      id,
      name: `Monster${id}`,
      type: 'goblin',
      position: { x: 10, y: 20 },
      attributes: { strength: 8, agility, health: 10 },
      combat: { hp: 50, maxHp: 50, isAlive: true },
      biomeId: 1,
      spawnedAt: new Date(),
      lastMove: new Date(),
      toJSON: jest.fn().mockReturnValue({
        id,
        name: `Monster${id}`,
        type: 'goblin',
        x: 10,
        y: 20,
        hp: 50,
        maxHp: 50,
        strength: 8,
        agility,
        health: 10,
        isAlive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        biomeId: 1,
        spawnedAt: new Date(),
        lastMove: new Date(),
      }),
    });

    it('should not trigger encounters when no monsters present', async () => {
      monsterService.getMonstersAtLocation.mockResolvedValue([]);

      const event: PlayerMoveEvent = {
        eventType: 'player:move',
        player: mockPlayer,
        fromX: 5,
        fromY: 15,
        toX: 10,
        toY: 20,
        timestamp: new Date(),
      };

      await service['handlePlayerMove'](event);

      expect(monsterService.getMonstersAtLocation).toHaveBeenCalledWith(10, 20);
      expect(EventBus.emit).not.toHaveBeenCalled();
      expect(combatService.monsterAttackPlayer).not.toHaveBeenCalled();
    });

    it('should emit monster:encounter event when monsters are present', async () => {
      const monster = createMockMonster(1, 10);
      monsterService.getMonstersAtLocation.mockResolvedValue([monster as any]);

      const event: PlayerMoveEvent = {
        eventType: 'player:move',
        player: mockPlayer,
        fromX: 5,
        fromY: 15,
        toX: 10,
        toY: 20,
        timestamp: new Date(),
      };

      await service['handlePlayerMove'](event);

      expect(EventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'monster:encounter',
          player: mockPlayer,
          x: 10,
          y: 20,
        }),
      );
    });

    it('should calculate attack chance correctly based on agility', async () => {
      // Test with different agility values
      const testCases = [
        { agility: 5, expectedChance: 25 }, // 5 * 5 = 25%
        { agility: 10, expectedChance: 50 }, // 10 * 5 = 50%
        { agility: 15, expectedChance: 75 }, // 15 * 5 = 75%
        { agility: 20, expectedChance: 95 }, // 20 * 5 = 100%, but capped at 95%
      ];

      for (const testCase of testCases) {
        const chance = service['calculateAttackChance'](testCase.agility);
        expect(chance).toBe(testCase.expectedChance);
      }
    });

    it('should trigger combat when roll succeeds', async () => {
      // Mock monster with high agility (guaranteed attack)
      const monster = createMockMonster(1, 20); // 95% chance
      monsterService.getMonstersAtLocation.mockResolvedValue([monster as any]);

      // Mock Math.random to return 0 (0% - will be less than 95%)
      jest.spyOn(Math, 'random').mockReturnValue(0);

      const event: PlayerMoveEvent = {
        eventType: 'player:move',
        player: mockPlayer,
        fromX: 5,
        fromY: 15,
        toX: 10,
        toY: 20,
        timestamp: new Date(),
      };

      await service['handlePlayerMove'](event);

      expect(combatService.monsterAttackPlayer).toHaveBeenCalledWith(
        1,
        'U123456',
      );

      jest.spyOn(Math, 'random').mockRestore();
    });

    it('should not trigger combat when roll fails', async () => {
      // Mock monster with low agility
      const monster = createMockMonster(1, 5); // 25% chance
      monsterService.getMonstersAtLocation.mockResolvedValue([monster as any]);

      // Mock Math.random to return 0.99 (99% - will be greater than 25%)
      jest.spyOn(Math, 'random').mockReturnValue(0.99);

      const event: PlayerMoveEvent = {
        eventType: 'player:move',
        player: mockPlayer,
        fromX: 5,
        fromY: 15,
        toX: 10,
        toY: 20,
        timestamp: new Date(),
      };

      await service['handlePlayerMove'](event);

      expect(combatService.monsterAttackPlayer).not.toHaveBeenCalled();

      jest.spyOn(Math, 'random').mockRestore();
    });

    it('should handle multiple monsters independently', async () => {
      const monster1 = createMockMonster(1, 20); // 95% chance
      const monster2 = createMockMonster(2, 20); // 95% chance
      monsterService.getMonstersAtLocation.mockResolvedValue([
        monster1 as any,
        monster2 as any,
      ]);

      // Mock random to make both attack
      jest.spyOn(Math, 'random').mockReturnValue(0);

      const event: PlayerMoveEvent = {
        eventType: 'player:move',
        player: mockPlayer,
        fromX: 5,
        fromY: 15,
        toX: 10,
        toY: 20,
        timestamp: new Date(),
      };

      await service['handlePlayerMove'](event);

      expect(combatService.monsterAttackPlayer).toHaveBeenCalledTimes(2);
      expect(combatService.monsterAttackPlayer).toHaveBeenCalledWith(
        1,
        'U123456',
      );
      expect(combatService.monsterAttackPlayer).toHaveBeenCalledWith(
        2,
        'U123456',
      );

      jest.spyOn(Math, 'random').mockRestore();
    });

    it('should skip combat if player has no slackId', async () => {
      const playerWithoutSlack = { ...mockPlayer, slackId: null };
      const monster = createMockMonster(1, 20);
      monsterService.getMonstersAtLocation.mockResolvedValue([monster as any]);
      jest.spyOn(Math, 'random').mockReturnValue(0);

      const event: PlayerMoveEvent = {
        eventType: 'player:move',
        player: playerWithoutSlack,
        fromX: 5,
        fromY: 15,
        toX: 10,
        toY: 20,
        timestamp: new Date(),
      };

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await service['handlePlayerMove'](event);

      expect(combatService.monsterAttackPlayer).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('no slackId'),
      );

      consoleErrorSpy.mockRestore();
      jest.spyOn(Math, 'random').mockRestore();
    });

    it('should handle errors gracefully', async () => {
      monsterService.getMonstersAtLocation.mockRejectedValue(
        new Error('Database error'),
      );

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const event: PlayerMoveEvent = {
        eventType: 'player:move',
        player: mockPlayer,
        fromX: 5,
        fromY: 15,
        toX: 10,
        toY: 20,
        timestamp: new Date(),
      };

      await service['handlePlayerMove'](event);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error handling monster encounter:',
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });
  });
});
