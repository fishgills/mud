import { BadRequestException, ConflictException } from '@nestjs/common';
import { TeleportService } from './teleport.service';
import type { Player } from '@mud/database';
import type { GuildHall, PlayerGuildState } from '@prisma/client';
import type { GuildTeleportResponse } from '@mud/api-contracts';

describe('guild-teleport TeleportService', () => {
  const playerService = {
    getPlayer: jest.fn(),
  } as unknown as { getPlayer: jest.Mock };
  const combatService = {
    isPlayerInCombat: jest.fn(),
  } as unknown as { isPlayerInCombat: jest.Mock };
  const repository = {
    getGuildHall: jest.fn(),
    getPlayerState: jest.fn(),
    movePlayerToGuild: jest.fn(),
    upsertPlayerState: jest.fn(),
  } as unknown as {
    getGuildHall: jest.Mock;
    getPlayerState: jest.Mock;
    movePlayerToGuild: jest.Mock;
    upsertPlayerState: jest.Mock;
  };
  const publisher = {
    emitTeleport: jest.fn(),
  } as unknown as { emitTeleport: jest.Mock };

  const makeService = () =>
    new TeleportService(
      playerService as never,
      combatService as never,
      repository as never,
      publisher as never,
    );

  const makePlayer = (overrides: Partial<Player> = {}): Player =>
    ({
      id: 42,
      name: 'Hero',
      x: 1,
      y: 2,
      hp: 10,
      maxHp: 10,
      agility: 5,
      strength: 5,
      health: 5,
      gold: 0,
      xp: 0,
      level: 1,
      skillPoints: 0,
      isAlive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      isInHq: false,
      isCreationComplete: false,
      lastAction: new Date(),
      ...overrides,
    }) as Player;

  const makeGuildHall = (): GuildHall => ({
    id: 1,
    slug: 'guild-hall',
    displayName: 'Adventurers Guild Hall',
    tileCoordinates: { x: 0, y: 0 },
    populationLimit: 50,
    services: { shop: true, crier: true, exits: ['return'] },
    teleportCooldownSeconds: 300,
    arrivalMessage: 'Welcome!',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const makeState = (
    overrides: Partial<PlayerGuildState> = {},
  ): PlayerGuildState => ({
    playerId: 42,
    lastTeleportAt: null,
    cooldownExpiresAt: null,
    lastGuildLocation: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects when player is in combat', async () => {
    const service = makeService();
    playerService.getPlayer.mockResolvedValue(makePlayer());
    combatService.isPlayerInCombat.mockResolvedValue(true);

    await expect(
      service.teleport({ teamId: 'T1', userId: 'U1', correlationId: 'corr' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects when cooldown is still active', async () => {
    const service = makeService();
    playerService.getPlayer.mockResolvedValue(makePlayer());
    combatService.isPlayerInCombat.mockResolvedValue(false);
    const future = new Date(Date.now() + 60_000);
    repository.getGuildHall.mockResolvedValue(makeGuildHall());
    repository.getPlayerState.mockResolvedValue(
      makeState({ cooldownExpiresAt: future }),
    );

    await expect(
      service.teleport({ teamId: 'T1', userId: 'U1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('teleports player, stores cooldown, and publishes arrival details', async () => {
    const service = makeService();
    const player = makePlayer();
    playerService.getPlayer.mockResolvedValue(player);
    combatService.isPlayerInCombat.mockResolvedValue(false);
    repository.getGuildHall.mockResolvedValue(makeGuildHall());
    repository.getPlayerState.mockResolvedValue(makeState());
    repository.movePlayerToGuild.mockResolvedValue({
      occupants: [7, 9],
      updatedPlayer: { ...player, isInHq: true },
    });
    repository.upsertPlayerState.mockResolvedValue(
      makeState({ lastTeleportAt: new Date(), cooldownExpiresAt: new Date() }),
    );

    const result = await service.teleport({ teamId: 'T1', userId: 'U1' });

    expect(repository.movePlayerToGuild).toHaveBeenCalled();
    expect(repository.upsertPlayerState).toHaveBeenCalled();
    expect(publisher.emitTeleport).toHaveBeenCalledWith(
      expect.objectContaining({
        playerId: player.id.toString(),
        occupantsNotified: ['7', '9'],
      }) satisfies Partial<GuildTeleportResponse>,
    );
    expect(result.arrivalMessage).toContain('Welcome');
  });
});
