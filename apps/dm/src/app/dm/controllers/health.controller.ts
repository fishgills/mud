import {
  Controller,
  Get,
  Post,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { GameTickService } from '../../game-tick/game-tick.service';

@Controller('dm')
export class HealthController {
  constructor(private gameTickService: GameTickService) {}

  // Health check endpoint
  @Get('health')
  health() {
    return { status: 'healthy', timestamp: new Date().toISOString() };
  }

  // Tick endpoint - called by the external tick service
  @Post('tick')
  async processTick() {
    try {
      const result = await this.gameTickService.processTick();
      return {
        success: true,
        data: result,
      };
    } catch {
      throw new HttpException(
        'Failed to process tick',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
