export interface GuildServicesStatus {
  shop: boolean;
  crier: boolean;
  exits: string[];
}

export interface GuildTeleportRequest {
  teamId: string;
  userId: string;
  playerId?: string;
  correlationId?: string;
  sourceTileId?: string;
  requestedAt: string;
}

export interface GuildTeleportResponse {
  success?: boolean;
  message?: string;
  playerId: string;
  guildTileId: string;
  arrivalMessage: string;
  services: GuildServicesStatus;
  occupantsNotified: string[];
  correlationId: string;
}

export interface GuildTradeRequest {
  playerId: string;
  itemId: string;
  quantity: number;
  correlationId: string;
}

export interface GuildTradeResponse {
  receiptId: string;
  playerId: string;
  itemId: string;
  direction: 'BUY' | 'SELL';
  goldDelta: number;
  remainingGold: number;
  inventoryDelta: number;
  stockRemaining: number;
  correlationId: string;
  itemName?: string;
  itemQuality?: string;
}

export interface GuildErrorResponse {
  code:
    | 'COOLDOWN'
    | 'COMBAT'
    | 'POPULATION_CAP'
    | 'INSUFFICIENT_GOLD'
    | 'OUT_OF_STOCK'
    | 'NOT_SELLABLE'
    | 'RATE_LIMIT';
  message: string;
  correlationId: string;
}

export interface GuildAnnouncementPayload {
  id: string;
  title: string;
  body: string;
  digest: string;
  priority: number;
  visibleUntil?: string;
}

export interface GuildAnnouncementPollRequest {
  jobId: string;
  polledAt: string;
  batchSize?: number;
}

export interface GuildAnnouncementPollResponse {
  announced: boolean;
  announcement?: GuildAnnouncementPayload;
  correlationId?: string;
}

export interface GuildCatalogItem {
  sku: string;
  name: string;
  description?: string;
  buyPriceGold: number;
  sellPriceGold: number;
  stockQuantity: number;
  tags: string[];
  attack?: number;
  defense?: number;
  healthBonus?: number;
  quality?: string;
}
