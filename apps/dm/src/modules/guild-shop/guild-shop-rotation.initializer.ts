import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { GuildShopRotationService } from './guild-shop-rotation.service';

@Injectable()
export class GuildShopRotationInitializer implements OnModuleInit {
  private readonly logger = new Logger(GuildShopRotationInitializer.name);

  constructor(private readonly rotationService: GuildShopRotationService) {}

  async onModuleInit(): Promise<void> {
    try {
      const result = await this.rotationService.rotateIfDue('manual');
      if (result.rotated) {
        this.logger.log(
          `Seeded initial guild catalog (${result.items ?? 0} items).`,
        );
      } else {
        this.logger.log(
          'Guild catalog already populated; skipping initial rotation.',
        );
      }
    } catch (error) {
      this.logger.error('Initial guild catalog setup failed', error as Error);
    }
  }
}
