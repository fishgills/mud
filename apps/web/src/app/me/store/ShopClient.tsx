'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ItemStatLine } from '@mud/inventory';
import type { GuildTradeResponse } from '@mud/api-contracts';
import { useGameEvents } from '../../lib/use-game-events';
import { withBasePath } from '../../lib/base-path';

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
    return { key: 'rare', label: 'Rare Ticket', icon: 'R' };
  }
  if (normalized === 'epic') {
    return { key: 'epic', label: 'Epic Ticket', icon: 'E' };
  }
  if (normalized === 'legendary') {
    return { key: 'legendary', label: 'Legendary Ticket', icon: 'L' };
  }
  return { key: normalized, label: `${ticketRequirement} Ticket`, icon: '?' };
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

const buildStatSummary = (item: ShopCatalogItemView): string[] => {
  const stats: string[] = [];
  if (item.damageRoll) {
    stats.push(`Damage ${item.damageRoll}`);
  }
  if (typeof item.strengthBonus === 'number' && item.strengthBonus !== 0) {
    stats.push(`Strength ${formatSignedStat(item.strengthBonus)}`);
  }
  if (typeof item.agilityBonus === 'number' && item.agilityBonus !== 0) {
    stats.push(`Agility ${formatSignedStat(item.agilityBonus)}`);
  }
  if (typeof item.healthBonus === 'number' && item.healthBonus !== 0) {
    stats.push(`Health ${formatSignedStat(item.healthBonus)}`);
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

  useGameEvents(['guild.shop.receipt', 'guild.shop.refresh'], handleShopEvent);

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

      <section className="shop-section">
        <h2 className="title-font shop-section-title">For Sale</h2>
        {catalog.length === 0 ? (
          <p className="text-sm text-[color:var(--ink-soft)]">
            The guild merchants are restocking. Check back in a few minutes.
          </p>
        ) : (
          <div className="shop-grid">
            {catalog.map((item) => {
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
                  !tag.startsWith('tier:') && !tag.startsWith('archetype:'),
              );
              return (
                <article key={item.sku} className="shop-card">
                  <header className="shop-card-header">
                    <div className="shop-card-name">
                      <span className="shop-quality">{item.qualityBadge}</span>
                      <span>
                        {item.qualityLabel} {item.name}
                      </span>
                    </div>
                    <span className="shop-price">
                      {formatPrice(item.buyPriceGold)}
                    </span>
                  </header>
                  {stats.length > 0 ? (
                    <div className="shop-card-meta">
                      {stats.map((stat) => (
                        <span key={stat}>{stat}</span>
                      ))}
                    </div>
                  ) : null}
                  {ticketInfo ? (
                    <div className="shop-card-meta">
                      <span className="shop-ticket">
                        <span
                          className={`ticket-icon ticket-icon-${ticketInfo.key}`}
                          aria-hidden="true"
                        >
                          {ticketInfo.icon}
                        </span>
                        <span>{ticketInfo.label}</span>
                      </span>
                    </div>
                  ) : null}
                  {visibleTags.length ? (
                    <div className="shop-tag-list">
                      {visibleTags.map((tag) => (
                        <span key={tag} className="shop-tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="shop-actions">
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
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="shop-section">
        <h2 className="title-font shop-section-title">Sell from Backpack</h2>
        {sellItems.length === 0 ? (
          <p className="text-sm text-[color:var(--ink-soft)]">
            You do not have any unequipped items to sell.
          </p>
        ) : (
          <div className="shop-sell-list">
            {sellItems.map((item) => (
              <article key={item.id} className="shop-card shop-sell-card">
                <header className="shop-card-header">
                  <div className="shop-card-name">
                    <span className="shop-quality">{item.qualityBadge}</span>
                    <span>
                      {item.qualityLabel} {item.name}
                    </span>
                    {item.quantity > 1 ? (
                      <span className="shop-quantity">x{item.quantity}</span>
                    ) : null}
                  </div>
                  <span className="shop-price">
                    {formatPrice(item.sellPriceGold)}
                  </span>
                </header>
                {item.stats.length > 0 ? (
                  <div className="shop-card-meta">
                    {item.stats.map((stat) => (
                      <span key={stat.label}>
                        {stat.label}: {stat.value}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="shop-actions">
                  <button
                    className="shop-button"
                    type="button"
                    onClick={() => handleSell(item.id)}
                    disabled={
                      pendingSellId !== null && pendingSellId !== item.id
                    }
                  >
                    {pendingSellId === item.id ? 'Selling…' : 'Sell'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
