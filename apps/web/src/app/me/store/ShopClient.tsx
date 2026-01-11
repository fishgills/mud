'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ItemStatLine } from '@mud/inventory';
import type { GuildTradeResponse } from '@mud/api-contracts';

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
  defense?: number | null;
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
};

const formatPrice = (value: number) => `${value} gold`;
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const withBasePath = (path: string) =>
  basePath && basePath !== '/' ? `${basePath}${path}` : path;

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

export default function ShopClient({ catalog, sellItems }: ShopClientProps) {
  const router = useRouter();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pendingSku, setPendingSku] = useState<string | null>(null);
  const [pendingSellId, setPendingSellId] = useState<number | null>(null);

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

      <section className="shop-section">
        <h2 className="title-font shop-section-title">For Sale</h2>
        {catalog.length === 0 ? (
          <p className="text-sm text-[color:var(--ink-soft)]">
            The guild merchants are restocking. Check back in a few minutes.
          </p>
        ) : (
          <div className="shop-grid">
            {catalog.map((item) => (
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
                {item.description ? (
                  <p className="shop-description">{item.description}</p>
                ) : null}
                {item.damageRoll || item.defense ? (
                  <div className="shop-card-meta">
                    {item.damageRoll ? (
                      <span>Damage {item.damageRoll}</span>
                    ) : null}
                    {item.defense ? <span>Armor +{item.defense}</span> : null}
                  </div>
                ) : null}
                {item.tags.length ? (
                  <div className="shop-tag-list">
                    {item.tags.map((tag) => (
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
                    disabled={
                      item.stockQuantity <= 0 ||
                      (pendingSku !== null && pendingSku !== item.sku)
                    }
                  >
                    {pendingSku === item.sku ? 'Buying…' : 'Buy'}
                  </button>
                </div>
              </article>
            ))}
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
                {item.description ? (
                  <p className="shop-description">{item.description}</p>
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
