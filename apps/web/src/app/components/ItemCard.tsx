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

type VariantStyles = {
  card: string;
  header: string;
  name: string;
  quantity: string;
  stats: string;
  stat: string;
  description: string;
  meta: string;
  price: string;
  actions: string;
  quality: string;
  headerAside: string;
};

const VARIANT_STYLES: Record<ItemCardVariant, VariantStyles> = {
  inventory: {
    card: 'inventory-backpack-item',
    header: 'inventory-item-header',
    name: 'inventory-item-name',
    quantity: 'inventory-quantity',
    stats: 'inventory-item-stats',
    stat: 'inventory-stat',
    description: 'inventory-item-desc',
    meta: 'inventory-item-meta',
    price: 'inventory-value',
    actions: 'inventory-item-actions',
    quality: '',
    headerAside: '',
  },
  slot: {
    card: 'inventory-item',
    header: 'inventory-item-header',
    name: 'inventory-item-name',
    quantity: 'inventory-quantity',
    stats: 'inventory-item-stats',
    stat: 'inventory-stat',
    description: 'inventory-item-desc',
    meta: 'inventory-item-meta',
    price: 'inventory-value',
    actions: 'inventory-item-actions',
    quality: '',
    headerAside: '',
  },
  shop: {
    card: 'shop-card',
    header: 'shop-card-header',
    name: 'shop-card-name',
    quantity: 'shop-quantity',
    stats: 'shop-card-meta',
    stat: '',
    description: 'shop-description',
    meta: 'shop-card-meta',
    price: '',
    actions: 'shop-actions',
    quality: 'shop-quality',
    headerAside: 'shop-price',
  },
};

const formatSellPrice = (value: number | null | undefined) => {
  if (value == null) return '—';
  return `${value} gold`;
};

const formatName = (qualityLabel: string | null | undefined, name: string) => {
  if (qualityLabel) {
    return `${qualityLabel} ${name}`;
  }
  return name;
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
  const styles = VARIANT_STYLES[variant];
  const displayName = formatName(qualityLabel, name);
  const hasMeta = showSellPrice || (meta !== null && meta !== undefined);
  const resolvedStats: ItemStatLine[] =
    stats && stats.length > 0 ? stats : [{ label: 'Stats', value: '—' }];

  return (
    <article className={styles.card}>
      <header className={styles.header}>
        <div className={styles.name}>
          {qualityBadge ? (
            <span className={styles.quality}>{qualityBadge}</span>
          ) : null}
          <span>{displayName}</span>
          {quantity && quantity > 1 ? (
            <span className={styles.quantity}>x{quantity}</span>
          ) : null}
        </div>
        {headerAside ? (
          <span className={styles.headerAside}>{headerAside}</span>
        ) : null}
      </header>
      <div className={styles.stats}>
        {resolvedStats.map((stat, index) => (
          <span
            key={`${stat.label}-${stat.value}-${index}`}
            className={styles.stat || undefined}
          >
            {stat.label}: {stat.value}
          </span>
        ))}
      </div>
      {hasMeta ? (
        <div className={styles.meta}>
          {showSellPrice ? (
            <span className={styles.price || undefined}>
              Sell price: {formatSellPrice(sellPriceGold)}
            </span>
          ) : null}
          {meta}
        </div>
      ) : null}
      {footer ?? null}
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </article>
  );
}
