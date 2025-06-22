import { Args, Query, Resolver, Int } from '@nestjs/graphql';
import { RenderService } from './render.service';
import { Injectable } from '@nestjs/common';

@Resolver()
@Injectable()
export class RenderResolver {
  constructor(private readonly renderService: RenderService) {}

  @Query(() => String, {
    description: 'Returns an ASCII map centered on (x, y) with a 50x50 region.',
  })
  async renderMapAscii(
    @Args('x', { type: () => Int, nullable: true }) x?: number,
    @Args('y', { type: () => Int, nullable: true }) y?: number,
  ): Promise<string> {
    const centerX = x ?? 0;
    const centerY = y ?? 0;
    const half = 25;
    const minX = centerX - half;
    const maxX = centerX + half;
    const minY = centerY - half;
    const maxY = centerY + half;
    return this.renderService.renderMapAscii(minX, maxX, minY, maxY);
  }

  // Note: Binary image (PNG) is not directly supported in GraphQL, so we return a base64 string
  @Query(() => String, {
    description:
      'Returns a PNG map centered on (x, y) as a base64 string (50x50 region).',
  })
  async renderMapPngBase64(
    @Args('x', { type: () => Int, nullable: true }) x?: number,
    @Args('y', { type: () => Int, nullable: true }) y?: number,
  ): Promise<string> {
    const centerX = x ?? 0;
    const centerY = y ?? 0;
    const half = 25;
    const minX = centerX - half;
    const maxX = centerX + half;
    const minY = centerY - half;
    const maxY = centerY + half;
    const canvas = await this.renderService.renderMap(minX, maxX, minY, maxY);
    return canvas.toBuffer('image/png').toString('base64');
  }
}
