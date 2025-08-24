import {
  Resolver,
  Query,
  Mutation,
  Args,
  ResolveField,
  Parent,
} from '@nestjs/graphql';
import { PlayerService } from '../../player/player.service';
import { MonsterService } from '../../monster/monster.service';
import { CombatService } from '../../combat/combat.service';
import { WorldService } from '../../world/world.service';
import { Player } from '../models/player.model';
import { Monster } from '../models/monster.model';
import { TileInfo } from '../models/tile-info.model';
import { CombatLog } from '../models/combat-log.model';
import {
  PlayerResponse,
  CombatResponse,
  PlayerStats,
  CombatResult,
  PlayerMoveResponse,
  PlayerMovementData,
  SurroundingTile,
  NearbyPlayerInfo,
} from '../types/response.types';
import {
  CreatePlayerInput,
  MovePlayerInput,
  PlayerStatsInput,
  AttackInput,
  TargetType,
} from '../inputs/player.input';
import { Logger } from '@nestjs/common';
import { OpenaiService } from '../../../openai/openai.service';
import { CoordinationService } from '../../../shared/coordination.service';
import { env } from '../../../env';
import { LookViewResponse } from '../types/response.types';
import type { NearbySettlement } from '../../world/world.service';
import { calculateDirection } from '../../shared/direction.util';

@Resolver(() => Player)
export class PlayerResolver {
  private logger = new Logger(PlayerResolver.name);
  // TTLs sourced from env for distributed cooldown/lock
  private readonly TILE_DESC_COOLDOWN_MS = env.TILE_DESC_COOLDOWN_MS;
  private readonly TILE_DESC_MIN_RETRY_MS = env.TILE_DESC_MIN_RETRY_MS;
  constructor(
    private playerService: PlayerService,
    private monsterService: MonsterService,
    private combatService: CombatService,
    private worldService: WorldService,
    private openaiService: OpenaiService,
    private coord: CoordinationService,
  ) {}

  @Mutation(() => PlayerResponse)
  async createPlayer(
    @Args('input') input: CreatePlayerInput,
  ): Promise<PlayerResponse> {
    const player = await this.playerService.createPlayer(input);
    return {
      success: true,
      data: player as Player,
    };
  }

  @Query(() => PlayerResponse)
  async getPlayer(@Args('slackId') slackId: string): Promise<PlayerResponse> {
    try {
      const player = await this.playerService.getPlayer(slackId);
      return {
        success: true,
        data: player as Player,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Player not found',
      };
    }
  }

  @Query(() => [Player])
  async getAllPlayers(): Promise<Player[]> {
    const players = await this.playerService.getAllPlayers();
    return players as Player[];
  }

  @Mutation(() => PlayerMoveResponse)
  async movePlayer(
    @Args('slackId') slackId: string,
    @Args('input') input: MovePlayerInput,
  ): Promise<PlayerMoveResponse> {
    try {
      const player = await this.playerService.movePlayer(slackId, input);
      const movementData = await this.buildMovementData(player, slackId, {
        generateDescription: false,
        minimal: true,
      });
      this.logger.debug(
        `Moved to (${player.x}, ${player.y}) with ${movementData.monsters.length} monster(s) nearby.`,
      );
      return { success: true, data: movementData };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to move player',
      };
    }
  }

  @Query(() => PlayerMoveResponse)
  async getMovementView(
    @Args('slackId') slackId: string,
  ): Promise<PlayerMoveResponse> {
    try {
      const player = await this.playerService.getPlayer(slackId);
      const movementData = await this.buildMovementData(player, slackId, {
        generateDescription: false,
      });
      return { success: true, data: movementData };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to fetch movement view',
      };
    }
  }

  // New: panoramic look view (does not persist AI descriptions; richer scene)
  @Query(() => LookViewResponse)
  async getLookView(
    @Args('slackId') slackId: string,
  ): Promise<LookViewResponse> {
    try {
      const t0 = Date.now();
      let tPlayerMs = 0;
      let tGetCenterMs = 0;
      let tGetCenterNearbyMs = 0;
      let tBoundsTilesMs = 0;
      let tExtBoundsMs = 0;
      let tFilterTilesMs = 0;
      let tPeaksSortMs = 0;
      let tBiomeSummaryMs = 0;
      let tSettlementsFilterMs = 0;
      let tAiMs = 0;
      let tilesCount = 0;
      let peaksCount = 0;

      const tPlayerStart = Date.now();
      const player = await this.playerService.getPlayer(slackId);
      tPlayerMs = Date.now() - tPlayerStart;
      // Start center-with-nearby immediately (single request for center + nearby)
      const tCenterNearbyStart = Date.now();
      const centerWithNearbyPromise = this.worldService
        .getTileInfoWithNearby(player.x, player.y)
        .then((d) => {
          tGetCenterNearbyMs = Date.now() - tCenterNearbyStart;
          return d;
        })
        .catch(() => null as any);

      // Kick off bounds using a conservative max radius to overlap with center fetch
      const maxVisibilityRadius = 12;
      const minXMax = player.x - maxVisibilityRadius;
      const maxXMax = player.x + maxVisibilityRadius;
      const minYMax = player.y - maxVisibilityRadius;
      const maxYMax = player.y + maxVisibilityRadius;
      const tBoundsStart = Date.now();
      const boundsPromise = this.worldService
        .getTilesInBounds(minXMax, maxXMax, minYMax, maxYMax)
        .then((res) => {
          tBoundsTilesMs = Date.now() - tBoundsStart;
          return res;
        });

      const peakScanRadiusMax = 30; // scan far for peaks regardless; we'll filter later
      const tExtBoundsStart = Date.now();
      const extPromise = this.worldService
        .getTilesInBounds(
          player.x - peakScanRadiusMax,
          player.x + peakScanRadiusMax,
          player.y - peakScanRadiusMax,
          player.y + peakScanRadiusMax,
        )
        .then((res) => {
          tExtBoundsMs = Date.now() - tExtBoundsStart;
          return res;
        });

      // Await center data now and compute dynamic visibility
      const centerWithNearby = await centerWithNearbyPromise;
      const centerTile =
        centerWithNearby?.tile ??
        ({
          x: player.x,
          y: player.y,
          biomeName: 'grassland',
          description: '',
          height: 0.5,
          temperature: 0.6,
          moisture: 0.5,
        } as any);

      // Compute visibility radius based on tile height (0..1)
      const base = 10;
      const heightFactor = Math.max(0, Math.min(1, centerTile.height));
      let visibilityRadius = Math.round(base + heightFactor * 7);
      visibilityRadius = Math.max(3, Math.min(12, visibilityRadius));

      // Gather bounds results (already in-flight)
      const [boundTiles, extTiles] = await Promise.all([
        boundsPromise,
        extPromise,
      ]);
      const tFilterTilesStart = Date.now();
      const tiles = boundTiles
        .map((t) => ({
          x: t.x,
          y: t.y,
          biomeName: t.biomeName,
          height: t.height,
        }))
        .filter(
          (t) =>
            Math.sqrt((t.x - player.x) ** 2 + (t.y - player.y) ** 2) <=
            visibilityRadius,
        );
      tFilterTilesMs = Date.now() - tFilterTilesStart;
      tilesCount = tiles.length;

      // Peaks: select top-k highest tiles beyond a near radius so they feel "distant peaks"
      const minPeakDistance = Math.max(3, Math.floor(visibilityRadius / 2));
      const tPeaksSortStart = Date.now();
      const peakCandidates = extTiles
        .filter(
          (t) =>
            Math.sqrt((t.x - player.x) ** 2 + (t.y - player.y) ** 2) >=
              minPeakDistance && t.height >= 0.7,
        )
        .sort((a, b) => b.height - a.height)
        .slice(0, 6);
      tPeaksSortMs = Date.now() - tPeaksSortStart;
      peaksCount = peakCandidates.length;

      const visiblePeaks = peakCandidates.map((t) => {
        const dx = t.x - player.x;
        const dy = t.y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const direction = calculateDirection(player.x, player.y, t.x, t.y);
        return { x: t.x, y: t.y, height: t.height, distance, direction };
      });

      // Biome sector summary: count tiles by biome and infer predominant directions
      const tBiomeStart = Date.now();
      const biomeCounts = new Map<string, number>();
      const biomeDirBuckets = new Map<string, Record<string, number>>();
      for (const t of tiles) {
        biomeCounts.set(t.biomeName, (biomeCounts.get(t.biomeName) || 0) + 1);
        const dir = calculateDirection(player.x, player.y, t.x, t.y);
        const bucket = biomeDirBuckets.get(t.biomeName) || {};
        bucket[dir] = (bucket[dir] || 0) + 1;
        biomeDirBuckets.set(t.biomeName, bucket);
      }
      const totalTiles = tiles.length || 1;
      const biomeSummary = Array.from(biomeCounts.entries())
        .map(([biomeName, count]) => {
          const dirs = biomeDirBuckets.get(biomeName) || {};
          const sortedDirs = Object.entries(dirs)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([d]) => d);
          return {
            biomeName,
            proportion: count / totalTiles,
            predominantDirections: sortedDirs,
          };
        })
        .sort((a, b) => b.proportion - a.proportion)
        .slice(0, 6);
      tBiomeSummaryMs = Date.now() - tBiomeStart;

      // Settlements: leverage nearby from the center-with-nearby result
      const tSettlementsStart = Date.now();
      const nearby: NearbySettlement[] =
        (centerWithNearby?.nearbySettlements as NearbySettlement[]) || [];
      let visibleSettlements = nearby
        .filter(
          (s) => s.distance <= visibilityRadius * 1.2 || s.size === 'large',
        )
        .map((s) => ({
          name: s.name,
          type: s.type,
          size: s.size,
          distance: s.distance,
          direction: calculateDirection(player.x, player.y, s.x, s.y),
        }));

      // If we're standing in a settlement, include it explicitly as distance 0 at "here"
      const currentSettlement = centerWithNearby?.currentSettlement;
      if (
        currentSettlement?.name &&
        currentSettlement?.type &&
        currentSettlement?.size
      ) {
        const alreadyIncluded = visibleSettlements.some(
          (s) =>
            s.name === currentSettlement.name &&
            s.type === currentSettlement.type,
        );
        if (!alreadyIncluded) {
          visibleSettlements = [
            {
              name: currentSettlement.name,
              type: currentSettlement.type,
              size: currentSettlement.size,
              distance: 0,
              direction: 'here',
            },
            ...visibleSettlements,
          ];
        }
      }
      tSettlementsFilterMs = Date.now() - tSettlementsStart;

      // Compose a concise panoramic description
      const topBiomes = biomeSummary.slice(0, 2).map((b) => b.biomeName);
      const peakLine = visiblePeaks.length
        ? `Distant peaks rise to the ${visiblePeaks
            .slice(0, 2)
            .map((p) => p.direction)
            .join(' and ')}`
        : '';
      // Build settlement line; read nicely when you're currently in a settlement
      let settleLine = '';
      if (visibleSettlements.length) {
        const here = visibleSettlements.find((s) => s.distance === 0);
        const others = visibleSettlements.filter((s) => s.distance > 0);
        if (here) {
          const lead = `You're in the ${here.type} ${here.name}.`;
          const also = others.length
            ? ` You also spot ${others
                .slice(0, 2)
                .map((s) => `${s.type} ${s.name} to the ${s.direction}`)
                .join(' and ')}`
            : '';
          settleLine = `${lead}${also}`.trim();
        } else {
          settleLine = `You spot signs of ${others
            .slice(0, 2)
            .map((s) => `${s.type} ${s.name} to the ${s.direction}`)
            .join(' and ')}`;
        }
      }
      // Build a descriptive paragraph; prefer AI if available for richer prose
      let description = [
        `From here you can see roughly ${visibilityRadius} tiles out across mostly ${
          topBiomes.join(' and ') || centerTile.biomeName
        }.`,
        peakLine,
        settleLine,
      ]
        .filter(Boolean)
        .join(' ');

      try {
        // Consider the player inside a settlement if the world service marks the current tile
        // as part of a settlement footprint (currentSettlement present), not just exact center.
        const inSettlement = Boolean(
          currentSettlement && currentSettlement.intensity > 0,
        );
        const context = {
          center: {
            x: centerTile.x,
            y: centerTile.y,
            biomeName: centerTile.biomeName,
            height: centerTile.height,
          },
          visibilityRadius,
          biomeSummary,
          visiblePeaks,
          visibleSettlements,
          currentSettlement: currentSettlement || null,
          inSettlement,
        };
        const baseInstructions = [
          'Write a short environmental description (2-4 sentences).',
          'Do NOT mention players, inhabitants, or monsters. Focus on place and setting.',
          'Use the JSON context for bearings and features but avoid explicit numbers unless natural.',
        ];
        const intensityVal = currentSettlement?.intensity ?? 0;
        const densityBucket =
          intensityVal >= 0.7
            ? 'high'
            : intensityVal >= 0.4
              ? 'medium'
              : intensityVal > 0
                ? 'low'
                : 'none';
        const settlementFocus = [
          'You are inside a settlement: make the description center on the settlement itself (architecture, layout, immediate surroundings, notable landmarks, atmosphere).',
          'Mention the settlement name and type once if present (e.g., "the hamlet South Manorthorpe").',
          'Optionally reference nearby terrain as backdrop, but keep the settlement as the focal point.',
          'Use currentSettlement.intensity to scale how built-up and busy it feels:',
          '- high (>= 0.7): dense core, closely packed structures, tight lanes, frequent activity/noise.',
          '- medium (0.4-0.69): mixed residential/commercial, some open space, steady but modest activity.',
          '- low (0.01-0.39): outskirts/edge, scattered buildings, paths/hedgerows/fields, quiet/occasional passersby.',
          'Do not invent crowds or specifics beyond what intensity implies; keep it grounded and qualitative.',
        ];
        const landscapeFocus = [
          'You are in the open: focus on terrain, weather, and distant features; settlements are secondary if visible.',
        ];
        const prompt = [
          ...(inSettlement ? settlementFocus : landscapeFocus),
          ...baseInstructions,
          'Context:',
          JSON.stringify(context, null, 2),
        ].join('\n');
        const tAiStart = Date.now();

        this.logger.debug(`getLookView prompt: ${prompt}`);
        const ai = await this.openaiService.getText(prompt, {
          timeoutMs: 1200, // keep latency tight; fallback if exceeded
          cacheKey: `look:${centerTile.x},${centerTile.y}:${visibilityRadius}:${topBiomes.join(',')}:${visiblePeaks
            .map((p) => p.direction)
            .join('/')}:${visibleSettlements
            .map((s) => `${s.type}-${s.direction}`)
            .join(
              '/',
            )}::${currentSettlement?.name ?? 'none'}:${inSettlement ? 'in' : 'out'}:${densityBucket}`,
          maxTokens: 120,
        });
        tAiMs = Date.now() - tAiStart;
        const aiText = (ai?.output_text ?? '').trim();
        if (aiText) description = aiText;
      } catch (e) {
        this.logger.debug('Panoramic AI description skipped or failed.');
      }

      const totalMs = Date.now() - t0;
      this.logger.debug(
        `getLookView perf slackId=${slackId} totalMs=${totalMs} playerMs=${tPlayerMs} getCenterMs=${tGetCenterMs} getCenterNearbyMs=${tGetCenterNearbyMs} boundsTilesMs=${tBoundsTilesMs} filterTilesMs=${tFilterTilesMs} extBoundsMs=${tExtBoundsMs} peaksSortMs=${tPeaksSortMs} biomeSummaryMs=${tBiomeSummaryMs} settlementsFilterMs=${tSettlementsFilterMs} aiMs=${tAiMs} tiles=${tilesCount} peaks=${peaksCount}`,
      );

      return {
        success: true,
        data: {
          location: {
            x: centerTile.x,
            y: centerTile.y,
            biomeName: centerTile.biomeName,
            description: centerTile.description || '',
            height: centerTile.height,
            temperature: centerTile.temperature,
            moisture: centerTile.moisture,
          },
          visibilityRadius,
          biomeSummary,
          visiblePeaks,
          visibleSettlements,
          currentSettlement: currentSettlement
            ? {
                name: currentSettlement.name,
                type: currentSettlement.type,
                size: currentSettlement.size,
                intensity: currentSettlement.intensity,
                isCenter: currentSettlement.isCenter,
              }
            : undefined,
          inSettlement: Boolean(
            currentSettlement && currentSettlement.intensity > 0,
          ),
          description,
        },
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to build look view',
      };
    }
  }

  // direction util now imported from shared/direction.util

  // Shared builder for PlayerMovementData used by both movePlayer and getMovementView
  private async buildMovementData(
    player: Player,
    slackId: string,
    options: { generateDescription?: boolean; minimal?: boolean } = {},
  ): Promise<PlayerMovementData> {
    const { generateDescription = false, minimal = false } = options;
    if (minimal) {
      // Return the lightest possible payload required by the client when moving.
      return {
        player: player as Player,
        location: {
          x: player.x,
          y: player.y,
          biomeName: '',
          description: '',
          height: 0,
          temperature: 0,
          moisture: 0,
        },
        monsters: [],
        nearbyPlayers: [],
        playerInfo: '',
        surroundingTiles: [],
        description: '',
      } as PlayerMovementData;
    }

    const [tileInfoWithNearby, monsters, nearbyPlayers, surroundingTiles] =
      await Promise.all([
        this.worldService.getTileInfoWithNearby(player.x, player.y),
        this.monsterService.getMonstersAtLocation(player.x, player.y),
        this.playerService.getNearbyPlayers(
          player.x,
          player.y,
          slackId,
          Infinity,
          10,
        ),
        this.worldService.getSurroundingTiles(player.x, player.y, 1),
      ]);

    const surroundingTilesWithDirection: SurroundingTile[] =
      surroundingTiles.map((tile) => ({
        x: tile.x,
        y: tile.y,
        biomeName: tile.biomeName,
        description: tile.description || '',
        direction: calculateDirection(player.x, player.y, tile.x, tile.y),
      }));

    const tileInfo: TileInfo = {
      x: tileInfoWithNearby.tile.x,
      y: tileInfoWithNearby.tile.y,
      biomeName: tileInfoWithNearby.tile.biomeName,
      description: tileInfoWithNearby.tile.description || '',
      height: tileInfoWithNearby.tile.height,
      temperature: tileInfoWithNearby.tile.temperature,
      moisture: tileInfoWithNearby.tile.moisture,
    };

    const movementData: PlayerMovementData = {
      player: player as Player,
      location: {
        ...tileInfo,
        description: generateDescription ? tileInfo.description : '',
      },
      monsters: monsters as Monster[],
      nearbyPlayers: (nearbyPlayers || []).map((p) => ({
        distance: p.distance,
        direction: p.direction,
        x: p.x,
        y: p.y,
      })) as NearbyPlayerInfo[],
      playerInfo: '',
      surroundingTiles: surroundingTilesWithDirection,
      description: generateDescription ? (tileInfo.description ?? '') : '',
      nearbyBiomes: tileInfoWithNearby.nearbyBiomes?.map(
        (b) =>
          `${b.biomeName} (${b.direction}, ${b.distance.toFixed(1)} units)`,
      ),
      nearbySettlements: tileInfoWithNearby.nearbySettlements?.map(
        (s) => `${s.name} (${s.type}, ${s.distance.toFixed(1)} units away)`,
      ),
      currentSettlement: tileInfoWithNearby.currentSettlement
        ? `${tileInfoWithNearby.currentSettlement.name} (${tileInfoWithNearby.currentSettlement.type}, intensity: ${tileInfoWithNearby.currentSettlement.intensity})`
        : undefined,
    };

    // If there's no description, generate one using OpenAI with non-dynamic context, persist to World, and return it
    if (
      generateDescription &&
      (!movementData.description || movementData.description.trim() === '')
    ) {
      try {
        const inSettlement = Boolean(tileInfoWithNearby.currentSettlement);
        const context = {
          player: {
            id: player.id,
            name: player.name,
            x: player.x,
            y: player.y,
          },
          location: {
            x: tileInfo.x,
            y: tileInfo.y,
            biomeName: tileInfo.biomeName,
            temperature: tileInfo.temperature,
            moisture: tileInfo.moisture,
          },
          surroundingTiles: surroundingTilesWithDirection.map((t) => ({
            x: t.x,
            y: t.y,
            biomeName: t.biomeName,
            direction: t.direction,
          })),
          nearbyBiomes: movementData.nearbyBiomes ?? [],
          nearbySettlements: movementData.nearbySettlements ?? [],
          currentSettlement: tileInfoWithNearby.currentSettlement || null,
          inSettlement,
        };

        const baseTileInstructions = [
          'Describe ONLY the environment for this single map tile in plain text (no code blocks or Slack formatting).',
          'Do NOT mention players, inhabitants, or monsters.',
          'Keep it concise but vivid (1-3 sentences).',
          'Use the JSON context for cohesion with surrounding tiles; avoid explicit numbers unless natural.',
        ];
        const intensityVal2 =
          tileInfoWithNearby.currentSettlement?.intensity ?? 0;
        const densityBucket2 =
          intensityVal2 >= 0.7
            ? 'high'
            : intensityVal2 >= 0.4
              ? 'medium'
              : intensityVal2 > 0
                ? 'low'
                : 'none';
        const settlementTileFocus = [
          'You are inside a settlement: make the description center on the settlement itself (architecture, materials, layout, immediate surroundings, notable landmarks, atmosphere).',
          'Mention the settlement name and type once if present (e.g., "the hamlet South Manorthorpe").',
          'Use currentSettlement.intensity to scale how built-up this specific tile is:',
          '- high (>= 0.7): dense center, close-packed structures, lanes, little open ground.',
          '- medium (0.4-0.69): mixed spaces and buildings, some yards/greens, steady use.',
          '- low (0.01-0.39): fringe/outskirts, sparse buildings, fields/hedges/tracks, quiet.',
          `Current intensity bucket: ${densityBucket2}. Reflect that subtly in the details.`,
        ];
        const openTileFocus = [
          'You are in the open: focus on the tile’s terrain and nearby natural features.',
        ];
        const prompt = [
          ...(inSettlement ? settlementTileFocus : openTileFocus),
          ...baseTileInstructions,
          'Context:',
          JSON.stringify(context, null, 2),
        ].join('\n');

        const tileKey = `${tileInfo.x},${tileInfo.y}`;
        const cdKey = `tile-desc-cooldown:${tileKey}`;
        const lockKey = `tile-desc-lock:${tileKey}`;
        // Distributed cooldown: skip if cooldown key exists
        if (await this.coord.exists(cdKey)) {
          return movementData;
        }

        // Acquire distributed lock
        const token = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const gotLock = await this.coord.acquireLock(
          lockKey,
          token,
          env.TILE_DESC_LOCK_TTL_MS,
        );
        if (!gotLock) {
          // Another instance is generating; quick exit. Optionally we could poll once later.
          return movementData;
        }
        try {
          // Re-check DB description after acquiring the lock (another instance may have filled it)
          const fresh = await this.worldService.getTileInfo(player.x, player.y);
          const already =
            fresh.description && fresh.description.trim().length > 0;
          if (already) {
            movementData.description = fresh.description || '';
            movementData.location.description = fresh.description || '';
            return movementData;
          }

          const ai = await this.openaiService.getText(prompt);
          const generated = (ai?.output_text ?? '').trim();
          if (generated) {
            await this.worldService.updateTileDescription(
              tileInfo.x,
              tileInfo.y,
              generated,
            );
            await this.coord.setCooldown(cdKey, this.TILE_DESC_COOLDOWN_MS);
            movementData.description = generated;
            movementData.location.description = generated;
          } else {
            // Empty output: set a short retry window
            await this.coord.setCooldown(cdKey, this.TILE_DESC_MIN_RETRY_MS);
          }
        } finally {
          await this.coord.releaseLock(lockKey, token);
        }
      } catch (e) {
        this.logger.warn(
          `AI description generation failed for (${tileInfo.x},${tileInfo.y}): ${e instanceof Error ? e.message : e}`,
        );
      }
    }

    return movementData;
  }

  @Mutation(() => PlayerResponse)
  async updatePlayerStats(
    @Args('slackId') slackId: string,
    @Args('input') input: PlayerStatsInput,
  ): Promise<PlayerResponse> {
    try {
      const player = await this.playerService.updatePlayerStats(slackId, input);
      return {
        success: true,
        data: player as Player,
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to update player stats',
      };
    }
  }

  @Mutation(() => PlayerResponse)
  async rerollPlayerStats(
    @Args('slackId') slackId: string,
  ): Promise<PlayerResponse> {
    try {
      const player = await this.playerService.rerollPlayerStats(slackId);
      return {
        success: true,
        data: player as Player,
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to reroll player stats',
      };
    }
  }

  @Mutation(() => PlayerResponse)
  async healPlayer(
    @Args('slackId') slackId: string,
    @Args('amount') amount: number,
  ): Promise<PlayerResponse> {
    try {
      const player = await this.playerService.healPlayer(slackId, amount);
      return {
        success: true,
        data: player as Player,
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to heal player',
      };
    }
  }

  @Mutation(() => PlayerResponse)
  async damagePlayer(
    @Args('slackId') slackId: string,
    @Args('damage') damage: number,
  ): Promise<PlayerResponse> {
    try {
      const player = await this.playerService.damagePlayer(slackId, damage);
      return {
        success: true,
        data: player as Player,
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to damage player',
      };
    }
  }

  @Query(() => [Player])
  async getPlayersAtLocation(
    @Args('x') x: number,
    @Args('y') y: number,
  ): Promise<Player[]> {
    const players = await this.playerService.getPlayersAtLocation(x, y);
    return players as Player[];
  }

  @Mutation(() => CombatResponse)
  async attack(
    @Args('slackId') slackId: string,
    @Args('input') input: AttackInput,
  ): Promise<CombatResponse> {
    try {
      let result;

      if (input.targetType === TargetType.MONSTER) {
        result = await this.combatService.playerAttackMonster(
          slackId,
          input.targetId,
        );
      } else if (input.targetType === TargetType.PLAYER) {
        // For player vs player, we need to find the target player by ID
        const allPlayers = await this.playerService.getAllPlayers();
        const targetPlayer = allPlayers.find((p) => p.id === input.targetId);

        if (!targetPlayer) {
          throw new Error('Target player not found');
        }

        result = await this.combatService.playerAttackPlayer(
          slackId,
          targetPlayer.slackId,
        );
      } else {
        throw new Error('Invalid target type');
      }

      return {
        success: true,
        data: result as CombatResult,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Attack failed',
      };
    }
  }

  @Mutation(() => PlayerResponse)
  async respawn(@Args('slackId') slackId: string): Promise<PlayerResponse> {
    try {
      const player = await this.playerService.respawnPlayer(slackId);
      return {
        success: true,
        data: player as Player,
        message: 'You have been resurrected at the starting location!',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Respawn failed',
      };
    }
  }

  @Mutation(() => PlayerResponse)
  async deletePlayer(
    @Args('slackId') slackId: string,
  ): Promise<PlayerResponse> {
    try {
      const player = await this.playerService.deletePlayer(slackId);
      return {
        success: true,
        data: player as Player,
        message: 'Character has been successfully deleted.',
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to delete character',
      };
    }
  }

  @Query(() => PlayerStats)
  async getPlayerStats(@Args('slackId') slackId: string): Promise<PlayerStats> {
    const player = await this.playerService.getPlayer(slackId);

    // Calculate D&D-like modifiers
    const strengthModifier = Math.floor((player.strength - 10) / 2);
    const agilityModifier = Math.floor((player.agility - 10) / 2);
    const healthModifier = Math.floor((player.health - 10) / 2);

    // Calculate derived stats
    const dodgeChance = Math.max(0, (player.agility - 10) * 5); // 5% per point above 10
    const baseDamage = `1d6${strengthModifier >= 0 ? '+' : ''}${strengthModifier}`;
    const armorClass = 10 + agilityModifier; // Basic AC calculation

    // Calculate XP needed for next level (simple progression: level * 100)
    const xpForNextLevel = player.level * 100;
    const xpProgress = player.xp - (player.level - 1) * 100;
    const xpNeeded = xpForNextLevel - player.xp;

    // Get recent combat history for this player's location
    const recentCombat = await this.combatService.getCombatLogForLocation(
      player.x,
      player.y,
    );

    return {
      player: player as Player,
      strengthModifier,
      agilityModifier,
      healthModifier,
      dodgeChance,
      baseDamage,
      armorClass,
      xpForNextLevel,
      xpProgress,
      xpNeeded,
      recentCombat: recentCombat as CombatLog[],
    };
  }

  // Field resolvers for on-demand data loading
  @ResolveField(() => TileInfo, { nullable: true })
  async currentTile(@Parent() player: Player): Promise<TileInfo | null> {
    try {
      const tileInfo = await this.worldService.getTileInfo(player.x, player.y);
      return {
        x: tileInfo.x,
        y: tileInfo.y,
        biomeName: tileInfo.biomeName,
        description: tileInfo.description,
        height: tileInfo.height,
        temperature: tileInfo.temperature,
        moisture: tileInfo.moisture,
      };
    } catch (error) {
      return null;
    }
  }

  @ResolveField(() => [Player], { nullable: true })
  async nearbyPlayers(@Parent() player: Player): Promise<Player[]> {
    try {
      // Get players within a 3x3 grid around the current player
      const nearbyPlayers: Player[] = [];
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue; // Skip the current player's location
          const playersAtLocation =
            await this.playerService.getPlayersAtLocation(
              player.x + dx,
              player.y + dy,
            );
          nearbyPlayers.push(...(playersAtLocation as Player[]));
        }
      }
      return nearbyPlayers;
    } catch (error) {
      return [];
    }
  }

  @ResolveField(() => [Monster], { nullable: true })
  async nearbyMonsters(@Parent() player: Player): Promise<Monster[]> {
    try {
      return (await this.monsterService.getMonstersAtLocation(
        player.x,
        player.y,
      )) as Monster[];
    } catch (error) {
      return [];
    }
  }
}
