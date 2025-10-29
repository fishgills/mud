export interface PlayerItemDto {
  id: number;
  playerId?: number;
  itemId: number;
  quality: string;
  equipped: boolean;
  slot?: string | null;
  // Allowed equip slots derived from the underlying Item definition (e.g. ['head'], ['weapon'])
  allowedSlots?: string[];
  createdAt: string;
}
