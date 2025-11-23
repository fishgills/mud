import { Controller, Get, Param } from '@nestjs/common';
import { getPrismaClient } from '@mud/database';

@Controller('items')
export class ItemController {
  @Get(':id')
  async getItemById(@Param('id') rawId: string) {
    const id = Number(rawId);
    if (!Number.isFinite(id) || id <= 0) {
      return { success: false, message: 'Invalid item id' };
    }

    try {
      const prisma = getPrismaClient();
      const item = await prisma.item.findUnique({ where: { id } });
      if (!item) {
        return { success: false, message: 'Item not found' };
      }

      const { name, type, description, value, damageRoll, defense, slot } =
        item;

      return {
        success: true,
        data: {
          id,
          name,
          type,
          description,
          value,
          damageRoll,
          defense,
          slot,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to load item',
      };
    }
  }
}
