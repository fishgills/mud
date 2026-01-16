import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CoordinationService } from '../../shared/coordination.service';
import { GuildShopRepository } from './guild-shop.repository';
import { env } from '../../env';
import { GuildShopPublisher } from './guild-shop.publisher';
import {
  computeGlobalTier,
  generateShopListings,
  hasChaseItem,
} from './guild-shop-progression';

const ROTATION_LOCK_KEY = 'guild:shop:rotation:lock';
const CHASE_PITY_REFRESHES = 20;

type RotationSource = 'tick' | 'manual';

@Injectable()
export class GuildShopRotationService {
  private readonly logger = new Logger(GuildShopRotationService.name);

  constructor(
    private readonly repository: GuildShopRepository,
    private readonly coordination: CoordinationService,
    private readonly publisher: GuildShopPublisher,
  ) {}

  async rotateIfDue(source: RotationSource = 'tick'): Promise<{
    rotated: boolean;
    items?: number;
  }> {
    const lockToken = randomUUID();
    const lock = await this.coordination.acquireLock(
      ROTATION_LOCK_KEY,
      lockToken,
      30_000,
    );
    if (!lock) {
      return { rotated: false };
    }

    try {
      const now = Date.now();
      const state = await this.repository.getShopState();
      const lastRefreshedAt = state?.lastRefreshedAt?.getTime() ?? 0;
      const due =
        source === 'manual' ||
        !state ||
        now - lastRefreshedAt >= env.GUILD_SHOP_ROTATION_INTERVAL_MS;
      if (!due) {
        return { rotated: false };
      }

      const medianLevel = await this.repository.getMedianPlayerLevel(
        env.ACTIVE_PLAYER_WINDOW_MINUTES,
      );
      const globalTier = computeGlobalTier(medianLevel);
      const refreshesSinceChase = state?.refreshesSinceChase ?? 0;
      const forceChase = refreshesSinceChase >= CHASE_PITY_REFRESHES;
      const listings = generateShopListings({ globalTier, forceChase });
      if (!listings.length) {
        this.logger.warn('Guild shop rotation skipped; no listings generated.');
        return { rotated: false };
      }

      const refreshId = randomUUID();
      const chaseHit = hasChaseItem(listings);
      const refreshCounter = chaseHit ? 0 : refreshesSinceChase + 1;

      await this.repository.replaceCatalog(listings, {
        refreshId,
        refreshesSinceChase: refreshCounter,
        globalTier,
        medianLevel,
        refreshedAt: new Date(),
      });

      this.logger.log(
        `Rotated guild shop with ${listings.length} item(s) via ${source}`,
      );
      void this.publisher.publishRefresh({
        source,
        items: listings.length,
      });
      return { rotated: true, items: listings.length };
    } catch (error) {
      this.logger.error('Guild shop rotation failed', error as Error);
      return { rotated: false };
    } finally {
      await this.coordination.releaseLock(ROTATION_LOCK_KEY, lockToken);
    }
  }
}
