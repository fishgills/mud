export class AppError extends Error {
  public code: string;
  public details?: unknown;

  constructor(code: string, message?: string, details?: unknown) {
    super(message ?? code);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
    // restore prototype chain
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const ErrCodes = {
  NOT_OWNED: 'NOT_OWNED',
  WORLD_ITEM_NOT_FOUND: 'WORLD_ITEM_NOT_FOUND',
  PLAYER_NOT_FOUND: 'PLAYER_NOT_FOUND',
  INVENTORY_FULL: 'INVENTORY_FULL',
  INVALID_SLOT: 'INVALID_SLOT',
  ITEM_NOT_EQUIPPABLE: 'ITEM_NOT_EQUIPPABLE',
  LOCKED: 'LOCKED',
};
