jest.mock('@mud/database', () => ({
  Monster: class {},
  getPrismaClient: jest.fn(),
}));

import { MovementResolver } from './movement.resolver';
import { MovePlayerInput } from '../inputs/player.input';
import { VisibilityService } from '../services/visibility.service';
import { PeakService } from '../services/peak.service';
import { BiomeService } from '../services/biome.service';
import { SettlementService } from '../services/settlement.service';
import { DescriptionService } from '../services/description.service';
import { ResponseService } from '../services/response.service';
import { AiService } from '../../../openai/ai.service';
import { LookViewResponse } from '../types/response.types';

describe('MovementResolver', () => {
  const basePlayer = {
    id: 1,
    name: 'Hero',
    clientId: 'U1',
    clientType: 'slack' as const,
    position: { x: 0, y: 0 },
    attributes: { strength: 10, agility: 10, health: 10 },
    combat: { hp: 10, maxHp: 10, isAlive: true },
    level: 1,
    xp: 0,
    gold: 0,
    skillPoints: 0,
  } as const;

  const createResolver = (
    overrides: Partial<Record<string, unknown>> = {},
  ) => {
    const playerService = {
      movePlayer: jest.fn(),
      getPlayersAtLocation: jest.fn().mockResolvedValue([{ name: 'Other' }]),
      getPlayer: jest.fn(),
      getNearbyPlayers: jest
        .fn()
        .mockResolvedValue([
          { slackId: 'S1', name: 'Scout', distance: 2, direction: 'north' },
        ]),
      updateLastAction: jest.fn().mockResolvedValue(undefined),
    };
    const worldService = {
      getTileInfoWithNearby: jest.fn().mockResolvedValue({
        tile: {
          x: 5,
          y: 6,
          biomeName: 'plains',
          description: 'flat',
          height: 0.6,
          temperature: 0.5,
          moisture: 0.4,
        },
        nearbySettlements: [
          {
            name: 'Hillfort',
            type: 'fort',
            size: 'large',
            distance: 3,
            direction: 'south',
            x: 6,
            y: 6,
            intensity: 1,
          },
        ],
        currentSettlement: {
          name: 'Hillfort',
          type: 'fort',
          size: 'large',
          intensity: 0.8,
        },
      }),
      getTilesInBounds: jest.fn().mockImplementation(() =>
        Promise.resolve(
          Array.from({ length: 10 }, (_, i) => ({
            x: 3 + (i % 2),
            y: 4 + Math.floor(i / 2),
            biomeName: i % 2 === 0 ? 'plains' : 'forest',
            height: 0.5 + i * 0.01,
          })),
        ),
      ),
    };
    const visibilityService = new VisibilityService(
      worldService as unknown as Parameters<
        typeof VisibilityService.prototype.constructor
      >[0],
    );
    const peakService = new PeakService();
    const biomeService = new BiomeService();
    const settlementService = new SettlementService();

    const aiService: Pick<AiService, 'getText'> = {
      getText: jest.fn().mockResolvedValue({
        output_text: 'AI description',
      }),
    };
    const descriptionService = new DescriptionService(aiService as AiService);
    const responseService = new ResponseService();
    const monsterService = {
      getMonstersAtLocation: jest.fn().mockResolvedValue([{ name: 'Goblin' }]),
    };

    const resolver = new MovementResolver(
      playerService as unknown as Parameters<
        typeof MovementResolver.prototype.constructor
      >[0],
      worldService as unknown as Parameters<
        typeof MovementResolver.prototype.constructor
      >[1],
      visibilityService,
      peakService,
      biomeService,
      settlementService,
      descriptionService,
      responseService,
      monsterService as unknown as Parameters<
        typeof MovementResolver.prototype.constructor
      >[8],
    );

    return {
      resolver,
      playerService,
      worldService,
      monsterService,
      descriptionService,
      ...overrides,
    };
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2024-01-01T00:00:00Z'));
    jest.spyOn(global.Math, 'random').mockReturnValue(0.2);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('moves a player and returns location data', async () => {
    const { resolver, playerService, monsterService } = createResolver();
    playerService.movePlayer.mockResolvedValue({
      ...basePlayer,
      position: { x: 1, y: 2 },
    });

    const result = await resolver.movePlayer(
      { direction: 'north' } as MovePlayerInput,
      'U1',
    );

    expect(result.success).toBe(true);
    expect(playerService.movePlayer).toHaveBeenCalledWith('U1', {
      direction: 'north',
    });
    expect(monsterService.getMonstersAtLocation).toHaveBeenCalledWith(1, 2);
    expect(result.player?.x).toBe(1);
    expect(result.player?.y).toBe(2);
  });

  it('falls back to current location when movement fails', async () => {
    const { resolver, playerService } = createResolver();
    playerService.movePlayer.mockRejectedValue(new Error('nope'));
    playerService.getPlayer.mockResolvedValue({
      ...basePlayer,
      position: { x: 9, y: 9 },
    });

    const result = await resolver.movePlayer(
      { direction: 'east' } as MovePlayerInput,
      'U1',
    );

    expect(result.success).toBe(false);
    expect(result.player?.x).toBe(9);
    expect(result.player?.y).toBe(9);
  });

  it('builds look view using AI description', async () => {
    process.env.DM_USE_VERTEX_AI = 'true';
    const { resolver, playerService, worldService, descriptionService } =
      createResolver();

    playerService.getPlayer.mockResolvedValue({
      ...basePlayer,
      position: { x: 3, y: 4 },
    });

    const response = (await resolver.getLookView('U1')) as LookViewResponse;

    expect(response.success).toBe(true);
    expect(worldService.getTileInfoWithNearby).toHaveBeenCalledWith(3, 4);
    expect(descriptionService['logger']).toBeDefined();
    expect(response.perf?.aiProvider).toBe('vertex');
  });

  it('returns failure message when look view building fails', async () => {
    process.env.DM_USE_VERTEX_AI = 'false';
    const { resolver, playerService } = createResolver();
    playerService.getPlayer.mockRejectedValue(new Error('missing'));

    const response = (await resolver.getLookView('U1')) as LookViewResponse;

    expect(response.success).toBe(false);
    expect(response.message).toContain('missing');
  });
});
