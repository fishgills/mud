import type {
  GuildAnnouncementPayload,
  GuildTradeResponse,
  GuildServicesStatus,
} from '@mud/api-contracts';

export enum GuildEventType {
  TeleportArrived = 'guild.teleport.arrived',
  ShopReceipt = 'guild.shop.receipt',
  AnnouncementDelivered = 'guild.announcement.delivered',
}

export interface GuildEventBase {
  type: GuildEventType;
  correlationId?: string;
  timestamp?: Date;
}

export interface GuildTeleportArrivedEvent extends GuildEventBase {
  type: GuildEventType.TeleportArrived;
  playerId: number;
  occupantIds: number[];
  services: GuildServicesStatus;
}

export interface GuildShopReceiptEvent extends GuildEventBase {
  type: GuildEventType.ShopReceipt;
  receipt: GuildTradeResponse;
}

export interface GuildAnnouncementEvent extends GuildEventBase {
  type: GuildEventType.AnnouncementDelivered;
  payload: GuildAnnouncementPayload;
  audience: 'guild' | 'global';
}

export type GuildEvent =
  | GuildTeleportArrivedEvent
  | GuildShopReceiptEvent
  | GuildAnnouncementEvent;
