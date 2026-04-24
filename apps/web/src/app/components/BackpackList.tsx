'use client';

import type { ReactNode } from 'react';
import type { ItemStatLine } from '@mud/inventory';
import ItemCard from './ItemCard';

export type BackpackListItem = {
  id?: number | string | null;
  name: string;
  qualityBadge?: string | null;
  qualityLabel?: string | null;
  quantity?: number | null;
  stats?: ItemStatLine[] | null;
  description?: string | null;
  sellPriceGold?: number | null;
  meta?: ReactNode;
  actions?: ReactNode;
};

type BackpackListProps = {
  items: BackpackListItem[];
  emptyMessage?: string;
  showSellPrice?: boolean;
};

export default function BackpackList({
  items,
  emptyMessage = 'Your backpack is empty.',
  showSellPrice = true,
}: BackpackListProps) {
  if (items.length === 0) {
    return (
      <p style={{ fontFamily: "'VT323',monospace", fontSize: 18, color: 'var(--ink-dim)', fontStyle: 'italic' }}>
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="bp-grid" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((item, index) => (
        <ItemCard
          key={item.id ?? `${item.name}-${index}`}
          variant="inventory"
          name={item.name}
          qualityBadge={item.qualityBadge}
          qualityLabel={item.qualityLabel}
          quantity={item.quantity}
          stats={item.stats ?? undefined}
          description={item.description}
          sellPriceGold={item.sellPriceGold}
          showSellPrice={showSellPrice}
          meta={item.meta}
          actions={item.actions}
        />
      ))}
    </div>
  );
}
