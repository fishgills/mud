import type {
  GuildAnnouncementPayload,
  GuildTradeResponse,
} from '@mud/api-contracts';

export enum GuildEventType {
  ShopReceipt = 'guild.shop.receipt',
  AnnouncementDelivered = 'guild.announcement.delivered',
}

export interface GuildEventBase {
  type: GuildEventType;
  correlationId?: string;
  timestamp?: Date;
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

export type GuildEvent = GuildShopReceiptEvent | GuildAnnouncementEvent;
