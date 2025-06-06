import { Controller, Get, Header, Param, Res } from '@nestjs/common';
import { RenderService } from './render.service';
import type { Response } from 'express';

@Controller('render')
export class RenderController {
  constructor(private readonly renderService: RenderService) {}
  @Get()
  @Header('Content-Type', 'image/png')
  async renderMap(
    @Param('minX') minX: string,
    @Param('maxX') maxX: string,
    @Param('minY') minY: string,
    @Param('maxY') maxY: string,
    @Res() res: Response,
  ) {
    const canvas = await this.renderService.renderMap(
      minX ? parseInt(minX) : -100,
      maxX ? parseInt(maxX) : 100,
      minY ? parseInt(minY) : -100,
      maxY ? parseInt(maxY) : 100,
    );

    const buffer = canvas.toBuffer('image/png');

    res.send(buffer);
  }

  @Get('ascii')
  async renderMapAscii(
    @Param('minX') minX: string,
    @Param('maxX') maxX: string,
    @Param('minY') minY: string,
    @Param('maxY') maxY: string,
  ) {
    const asciiMap = await this.renderService.renderMapAscii(
      minX ? parseInt(minX) : -50,
      maxX ? parseInt(maxX) : 50,
      minY ? parseInt(minY) : -50,
      maxY ? parseInt(maxY) : 50,
    );

    return asciiMap;
  }
}
