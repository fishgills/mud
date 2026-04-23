'use client';

import type { ReactNode } from 'react';
import type { ItemStatLine } from '@mud/inventory';

type ItemCardVariant = 'inventory' | 'slot' | 'shop';

type ItemCardProps = {
  variant: ItemCardVariant;
  name: string;
  qualityBadge?: string | null;
  qualityLabel?: string | null;
  stats?: ItemStatLine[] | null;
  description?: string | null;
  quantity?: number | null;
  sellPriceGold?: number | null;
  showSellPrice?: boolean;
  headerAside?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
};

const normalizeRarity = (qualityLabel: string | null | undefined): string => {
  const q = qualityLabel?.toLowerCase() ?? '';
  if (q.includes('legendary')) return 'legendary';
  if (q.includes('epic')) return 'epic';
  if (q.includes('rare')) return 'rare';
  return 'common';
};

const formatSellPrice = (value: number | null | undefined) => {
  if (value == null) return '—';
  return `${value} gold`;
};

export default function ItemCard({
  variant,
  name,
  qualityBadge,
  qualityLabel,
  stats,
  description,
  quantity,
  sellPriceGold,
  showSellPrice = true,
  headerAside,
  meta,
  actions,
  footer,
}: ItemCardProps) {
  const rarity = normalizeRarity(qualityLabel);
  const resolvedStats: ItemStatLine[] =
    stats && stats.length > 0 ? stats : [{ label: 'Stats', value: '—' }];

  if (variant === 'slot') {
    return (
      <>
        {qualityBadge ? (
          <span className={`badge badge-${rarity}`}>{qualityBadge}</span>
        ) : null}
        <span className="slot-name">{name}</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 8px' }}>
          {resolvedStats.map((stat, index) => (
            <span key={`${stat.label}-${stat.value}-${index}`} className="slot-stat">
              {stat.label}: {stat.value}
            </span>
          ))}
        </div>
        {showSellPrice && sellPriceGold != null ? (
          <span className="slot-stat">
            Sell: <span className="inventory-gold">{formatSellPrice(sellPriceGold)}</span>
          </span>
        ) : null}
        {actions ? <div style={{ marginTop: 4 }}>{actions}</div> : null}
      </>
    );
  }

  if (variant === 'inventory') {
    return (
      <article className={`bp-card rarity-${rarity}`}>
        <div className="bp-header">
          {qualityBadge ? (
            <span className={`badge badge-${rarity}`}>{qualityBadge}</span>
          ) : null}
          <span className="bp-name">{name}</span>
          {quantity && quantity > 1 ? (
            <span className="bp-qty">x{quantity}</span>
          ) : null}
        </div>
        {description ? (
          <div className="bp-desc">{description}</div>
        ) : null}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 8px' }}>
          {resolvedStats.map((stat, index) => (
            <span
              key={`${stat.label}-${stat.value}-${index}`}
              style={{ fontFamily: "'VT323',monospace", fontSize: 16, color: 'var(--hp)' }}
            >
              {stat.label}: {stat.value}
            </span>
          ))}
        </div>
        {showSellPrice || meta ? (
          <div className="bp-meta">
            {showSellPrice && sellPriceGold != null ? (
              <span>
                Sell: <span className="inventory-gold">{formatSellPrice(sellPriceGold)}</span>
              </span>
            ) : null}
            {meta}
          </div>
        ) : null}
        {footer ?? null}
        {actions ? <div className="bp-actions">{actions}</div> : null}
      </article>
    );
  }

  // shop variant
  return (
    <article className={`item-card rarity-${rarity}`}>
      <div className="item-card-top">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {qualityBadge ? (
            <span className={`badge badge-${rarity}`}>{qualityBadge}</span>
          ) : null}
          <span className="item-card-name">{name}</span>
          {quantity && quantity > 1 ? (
            <span style={{ fontFamily: "'VT323',monospace", fontSize: 16, color: 'var(--ink-soft)' }}>
              x{quantity}
            </span>
          ) : null}
        </div>
        {headerAside ? (
          <span className="item-card-price">{headerAside}</span>
        ) : null}
      </div>
      {description ? (
        <div className="item-card-desc">{description}</div>
      ) : null}
      <div className="item-card-stats">
        {resolvedStats.map((stat, index) => (
          <span key={`${stat.label}-${stat.value}-${index}`} className="item-card-stat">
            {stat.label}: {stat.value}
          </span>
        ))}
      </div>
      {meta ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 8px', fontSize: 14 }}>
          {meta}
        </div>
      ) : null}
      {footer ?? null}
      {actions ? <div className="item-card-actions">{actions}</div> : null}
    </article>
  );
}
