import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { EncounterService } from './encounter.service';
import { MonsterService } from '../monster/monster.service';
import { EventBus } from '../../shared/event-bus';
import type { PlayerMoveEvent } from '../../shared/event-bus';
import type { MonsterEntity } from '@mud/engine';

// Mock database package
jest.mock('@mud/database', () => ({
  getPrismaClient: jest.fn(),
}));

// Mock EventBus
jest.mock('../../shared/event-bus', () => ({
  EventBus: {
    on: jest.fn(),
    emit: jest.fn(),
  },
}));

describe('EncounterService', () => {
  let service: EncounterService;
  let monsterService: jest.Mocked<MonsterService>;

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
      ],
    }).compile();

    service = module.get<EncounterService>(EncounterService);
    monsterService = module.get(MonsterService);

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

    const createMockMonster = (id: number) => ({
      id,
      name: `Monster${id}`,
      type: 'goblin',
      position: { x: 10, y: 20 },
      attributes: { strength: 8, agility: 10, health: 10 },
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
        agility: 10,
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
    });

    it('should emit monster:encounter event when monsters are present', async () => {
      const monster = createMockMonster(1);
      monsterService.getMonstersAtLocation.mockResolvedValue([
        monster as unknown,
      ]);

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

    it('should emit monster:encounter for multiple monsters without triggering combat', async () => {
      const monster1 = createMockMonster(1);
      const monster2 = createMockMonster(2);
      monsterService.getMonstersAtLocation.mockResolvedValue([
        monster1 as unknown as MonsterEntity,
        monster2 as unknown as MonsterEntity,
      ]);

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

      // Should only emit monster:encounter event, never combat:initiate
      const encounterCalls = (EventBus.emit as jest.Mock).mock.calls.filter(
        ([payload]) => payload.eventType === 'monster:encounter',
      );
      const combatCalls = (EventBus.emit as jest.Mock).mock.calls.filter(
        ([payload]) => payload.eventType === 'combat:initiate',
      );

      expect(encounterCalls).toHaveLength(1);
      expect(combatCalls).toHaveLength(0);
    });

    it('should handle errors gracefully', async () => {
      monsterService.getMonstersAtLocation.mockRejectedValue(
        new Error('Database error'),
      );

      const loggerErrorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);

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

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Error handling monster encounter event',
        expect.any(Error),
      );

      loggerErrorSpy.mockRestore();
    });
  });
});
