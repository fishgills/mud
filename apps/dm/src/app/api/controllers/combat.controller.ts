import { Controller, Get, Param } from '@nestjs/common';
import { CombatService } from '../../combat/combat.service';
import type { CombatLogDetailResponse } from '../dto/responses.dto';

@Controller('combat')
export class CombatController {
  constructor(private readonly combatService: CombatService) {}

  @Get('logs/:combatId')
  async getCombatLog(
    @Param('combatId') combatId: string,
  ): Promise<CombatLogDetailResponse> {
    if (!combatId) {
      return { success: false, message: 'combatId is required' };
    }

    const log = await this.combatService.getCombatLogByCombatId(combatId);
    if (!log) {
      return { success: false, message: 'Combat log not found' };
    }

    return { success: true, data: log };
  }
}
