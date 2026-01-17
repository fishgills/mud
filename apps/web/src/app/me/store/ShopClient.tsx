'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ItemStatLine } from '@mud/inventory';
import type { GuildTradeResponse } from '@mud/api-contracts';
import { useGameEvents } from '../../lib/use-game-events';
import { withBasePath } from '../../lib/base-path';
import StoreItemSection, { type StoreItemCardView } from './StoreItemSection';

export type ShopCatalogItemView = {
  sku: string;
  name: string;
  description: string;
  buyPriceGold: number;
  sellPriceGold: number;
  stockQuantity: number;
  tags: string[];
  qualityBadge: string;
  qualityLabel: string;
  damageRoll?: string | null;
  strengthBonus?: number | null;
  agilityBonus?: number | null;
  healthBonus?: number | null;
  ticketRequirement?: string | null;
};

export type ShopSellItemView = {
  id: number;
  name: string;
  qualityBadge: string;
  qualityLabel: string;
  quantity: number;
  stats: ItemStatLine[];
  description: string | null;
  sellPriceGold: number;
};

type Notice = { tone: 'success' | 'error'; message: string };

type ShopClientProps = {
  catalog: ShopCatalogItemView[];
  sellItems: ShopSellItemView[];
  playerGold: number;
  ticketCounts: {
    rare: number;
    epic: number;
    legendary: number;
  };
  refreshIntervalMs: number;
  lastRefreshAt: string | null;
};

const formatPrice = (value: number) => `${value} gold`;
const formatSignedStat = (value: number) =>
  value >= 0 ? `+${value}` : `${value}`;
const resolveTicketInfo = (ticketRequirement?: string | null) => {
  if (!ticketRequirement) return null;
  const normalized = ticketRequirement.toLowerCase();
  if (normalized === 'rare') {
    return { key: 'rare', label: 'Rare ticket' };
  }
  if (normalized === 'epic') {
    return { key: 'epic', label: 'Epic ticket' };
  }
  if (normalized === 'legendary') {
    return { key: 'legendary', label: 'Legendary ticket' };
  }
  return { key: normalized, label: `${ticketRequirement} ticket` };
};

const formatCountdown = (milliseconds: number): string => {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
    return '0:00';
  }
  const totalSeconds = Math.ceil(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const paddedSeconds = String(seconds).padStart(2, '0');
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${paddedSeconds}`;
  }
  return `${minutes}:${paddedSeconds}`;
};

const buildStatSummary = (item: ShopCatalogItemView): ItemStatLine[] => {
  const stats: ItemStatLine[] = [];
  if (item.damageRoll) {
    stats.push({ label: 'Damage', value: item.damageRoll });
  }
  if (typeof item.strengthBonus === 'number' && item.strengthBonus !== 0) {
    stats.push({
      label: 'Strength',
      value: formatSignedStat(item.strengthBonus),
    });
  }
  if (typeof item.agilityBonus === 'number' && item.agilityBonus !== 0) {
    stats.push({
      label: 'Agility',
      value: formatSignedStat(item.agilityBonus),
    });
  }
  if (typeof item.healthBonus === 'number' && item.healthBonus !== 0) {
    stats.push({ label: 'Health', value: formatSignedStat(item.healthBonus) });
  }
  return stats;
};

const parseResponse = async (
  response: Response,
): Promise<GuildTradeResponse> => {
  const data = (await response.json().catch(() => null)) as
    | GuildTradeResponse
    | { message?: string }
    | null;
  if (!response.ok) {
    const message =
      data && 'message' in data && typeof data.message === 'string'
        ? data.message
        : 'Request failed.';
    throw new Error(message);
  }
  if (!data) {
    throw new Error('Empty response.');
  }
  return data as GuildTradeResponse;
};

export default function ShopClient({
  catalog,
  sellItems,
  playerGold,
  ticketCounts,
  refreshIntervalMs,
  lastRefreshAt,
}: ShopClientProps) {
  const router = useRouter();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pendingSku, setPendingSku] = useState<string | null>(null);
  const [pendingSellId, setPendingSellId] = useState<number | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());
  const [nextRefreshAt, setNextRefreshAt] = useState<number>(() => {
    const base = lastRefreshAt ? new Date(lastRefreshAt).getTime() : Date.now();
    return base + refreshIntervalMs;
  });

  const handleShopEvent = useCallback(
    (
      payload: { type?: string; event?: { eventType?: string } },
      eventName: string,
    ) => {
      const payloadEvent =
        payload.event?.eventType ?? payload.type ?? eventName;
      if (payloadEvent === 'guild.shop.refresh') {
        const next = Date.now() + refreshIntervalMs;
        setNextRefreshAt(next);
        setNow(Date.now());
      }
      router.refresh();
    },
    [refreshIntervalMs, router],
  );

  useGameEvents(
    ['guild.shop.receipt', 'guild.shop.refresh', 'run:end'],
    handleShopEvent,
  );

  useEffect(() => {
    const base = lastRefreshAt ? new Date(lastRefreshAt).getTime() : Date.now();
    setNextRefreshAt(base + refreshIntervalMs);
  }, [lastRefreshAt, refreshIntervalMs]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const timeLeftMs = Math.max(0, nextRefreshAt - now);
  const countdownLabel = formatCountdown(timeLeftMs);
  const showTimer = Number.isFinite(refreshIntervalMs) && refreshIntervalMs > 0;
  const forSaleItems: StoreItemCardView[] = catalog.map((item) => {
    const stats = buildStatSummary(item);
    const ticketInfo = resolveTicketInfo(item.ticketRequirement);
    const hasTicket = ticketInfo
      ? (ticketCounts as Record<string, number>)[ticketInfo.key] > 0
      : true;
    const hasGold = playerGold >= item.buyPriceGold;
    const canBuy =
      item.stockQuantity > 0 &&
      hasTicket &&
      hasGold &&
      !(pendingSku !== null && pendingSku !== item.sku);
    const visibleTags = item.tags.filter(
      (tag) =>
        !tag.startsWith('tier:') &&
        !tag.startsWith('archetype:') &&
        !tag.startsWith('slot:'),
    );

    return {
      id: item.sku,
      name: item.name,
      qualityBadge: item.qualityBadge,
      qualityLabel: item.qualityLabel,
      stats,
      headerAside: formatPrice(item.buyPriceGold),
      meta: ticketInfo ? (
        <span
          className="shop-ticket"
          role="img"
          aria-label={`${ticketInfo.label} required`}
        >
          <span
            className={`ticket-icon ticket-icon-${ticketInfo.key}`}
            aria-hidden="true"
          >
            <svg
              className="ticket-icon-svg"
              viewBox="0 0 24 24"
              role="presentation"
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2.5 2.5 0 0 0 0 5v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2.5 2.5 0 0 0 0-5V7z" />
            </svg>
          </span>
          <span className="shop-ticket-text">Ticket required</span>
        </span>
      ) : null,
      footer: visibleTags.length ? (
        <div className="shop-tag-list">
          {visibleTags.map((tag) => (
            <span key={tag} className="shop-tag">
              {tag}
            </span>
          ))}
        </div>
      ) : null,
      actions: (
        <>
          <span className="shop-stock">
            Stock {Math.max(0, item.stockQuantity)}
          </span>
          <button
            className="shop-button"
            type="button"
            onClick={() => handleBuy(item.sku)}
            disabled={!canBuy}
          >
            {pendingSku === item.sku ? 'Buying…' : 'Buy'}
          </button>
        </>
      ),
    };
  });
  const sellBackpackItems: StoreItemCardView[] = sellItems.map((item) => ({
    id: item.id,
    name: item.name,
    qualityBadge: item.qualityBadge,
    qualityLabel: item.qualityLabel,
    quantity: item.quantity,
    stats: item.stats,
    actions: (
      <button
        className="shop-button"
        type="button"
        onClick={() => handleSell(item.id)}
        disabled={pendingSellId !== null && pendingSellId !== item.id}
      >
        {pendingSellId === item.id ? 'Selling…' : 'Sell'}
      </button>
    ),
  }));

  const handleBuy = async (sku: string) => {
    setNotice(null);
    setPendingSku(sku);
    try {
      const response = await fetch(withBasePath('/api/shop/buy'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sku }),
      });
      const data = await parseResponse(response);
      const cost = Math.abs(data.goldDelta ?? 0);
      setNotice({
        tone: 'success',
        message: `Purchase complete. Spent ${formatPrice(cost)}.`,
      });
      router.refresh();
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Purchase failed.',
      });
    } finally {
      setPendingSku(null);
    }
  };

  const handleSell = async (playerItemId: number) => {
    setNotice(null);
    setPendingSellId(playerItemId);
    try {
      const response = await fetch(withBasePath('/api/shop/sell'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ playerItemId }),
      });
      const data = await parseResponse(response);
      const gain = Math.abs(data.goldDelta ?? 0);
      setNotice({
        tone: 'success',
        message: `Sale complete. Earned ${formatPrice(gain)}.`,
      });
      router.refresh();
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Sale failed.',
      });
    } finally {
      setPendingSellId(null);
    }
  };

  return (
    <div className="shop-content">
      {notice ? (
        <div
          className={`shop-notice ${
            notice.tone === 'success'
              ? 'shop-notice-success'
              : 'shop-notice-error'
          }`}
          role={notice.tone === 'error' ? 'alert' : 'status'}
        >
          {notice.message}
        </div>
      ) : null}
      {showTimer ? (
        <div className="shop-timer" aria-live="polite">
          Refresh in {countdownLabel}
        </div>
      ) : null}

      <StoreItemSection
        title="For Sale"
        items={forSaleItems}
        emptyMessage="The guild merchants are restocking. Check back in a few minutes."
      />

      <StoreItemSection
        title="Sell from Backpack"
        items={sellBackpackItems}
        emptyMessage="You do not have any unequipped items to sell."
      />
    </div>
  );
}
