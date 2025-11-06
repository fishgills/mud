import { PlayerSlot } from '@prisma/client';
import { PlayerItemService } from './player-item.service';

export class PlayerItemController {
  private service = new PlayerItemService();

  constructor() {}

  async getItems(req: { params: { id: string } }) {
    const playerId = Number(req.params.id);
    return this.service.listBag(playerId);
  }

  async pickup(req: { params: { id: string }; body: { worldItemId: number } }) {
    const playerId = Number(req.params.id);
    return this.service.pickup(playerId, req.body.worldItemId);
  }

  async equip(req: {
    params: { id: string };
    body: { playerItemId: number; slot: string };
  }) {
    const playerId = Number(req.params.id);
    const slot = req.body.slot;
    if (
      typeof slot !== 'string' ||
      !Object.values(PlayerSlot).includes(slot as PlayerSlot)
    ) {
      throw new Error('Invalid slot');
    }
    return this.service.equip(
      playerId,
      req.body.playerItemId,
      slot as PlayerSlot,
    );
  }

  async drop(req: { params: { id: string }; body: { playerItemId: number } }) {
    const playerId = Number(req.params.id);
    return this.service.drop(playerId, req.body.playerItemId);
  }
}
