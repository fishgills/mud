import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { HqService, HqTransition, HqExitMode } from './hq.service';

interface EnterBody {
  playerId: number;
}

interface ExitBody {
  playerId: number;
  mode?: HqExitMode;
}

@Controller('hq')
export class HqController {
  constructor(private readonly hqService: HqService) {}

  @Post('enter')
  async enter(@Body() body: EnterBody): Promise<HqTransition> {
    if (!body?.playerId || Number.isNaN(body.playerId)) {
      throw new BadRequestException('playerId is required');
    }
    return this.hqService.enter(body.playerId);
  }

  @Post('exit')
  async exit(@Body() body: ExitBody): Promise<HqTransition> {
    if (!body?.playerId || Number.isNaN(body.playerId)) {
      throw new BadRequestException('playerId is required');
    }
    const mode: HqExitMode = body.mode === 'return' ? 'return' : 'random';
    return this.hqService.exit(body.playerId, mode);
  }

  @Get(':playerId')
  async status(
    @Param('playerId', ParseIntPipe) playerId: number,
  ): Promise<HqTransition> {
    return this.hqService.getStatus(playerId);
  }
}
