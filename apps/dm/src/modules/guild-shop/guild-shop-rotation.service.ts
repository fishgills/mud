import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CoordinationService } from '../../shared/coordination.service';
import { GuildShopRepository } from './guild-shop.repository';
import { env } from '../../env';

const ROTATION_LOCK_KEY = 'guild:shop:rotation:lock';
const ROTATION_COOLDOWN_KEY = 'guild:shop:rotation:cooldown';

type RotationSource = 'tick' | 'manual';

@Injectable()
export class GuildShopRotationService {
  private readonly logger = new Logger(GuildShopRotationService.name);

  constructor(
    private readonly repository: GuildShopRepository,
    private readonly coordination: CoordinationService,
  ) {}

  async rotateIfDue(source: RotationSource = 'tick'): Promise<{
    rotated: boolean;
    items?: number;
  }> {
    const cooldownActive = await this.coordination.exists(
      ROTATION_COOLDOWN_KEY,
    );
    if (cooldownActive) {
      return { rotated: false };
    }

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
      const items = await this.repository.pickRandomItems(
        env.GUILD_SHOP_ROTATION_SIZE,
      );
      if (!items.length) {
        this.logger.warn(
          'Guild shop rotation skipped; no eligible items were found.',
        );
        return { rotated: false };
      }

      await this.repository.deactivateCatalog();
      await this.repository.createCatalogEntriesFromItems(items, {
        rotationIntervalMinutes: Math.max(
          1,
          Math.floor(env.GUILD_SHOP_ROTATION_INTERVAL_MS / 60_000),
        ),
      });
      await this.coordination.setCooldown(
        ROTATION_COOLDOWN_KEY,
        env.GUILD_SHOP_ROTATION_INTERVAL_MS,
      );
      this.logger.log(
        `Rotated guild shop with ${items.length} item(s) via ${source}`,
      );
      return { rotated: true, items: items.length };
    } catch (error) {
      this.logger.error('Guild shop rotation failed', error as Error);
      return { rotated: false };
    } finally {
      await this.coordination.releaseLock(ROTATION_LOCK_KEY, lockToken);
    }
  }
}
