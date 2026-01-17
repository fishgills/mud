'use client';

import type { ReactNode } from 'react';
import type { ItemStatLine } from '@mud/inventory';
import ItemCard from '../../components/ItemCard';

export type StoreItemCardView = {
  id?: number | string | null;
  name: string;
  qualityBadge?: string | null;
  qualityLabel?: string | null;
  quantity?: number | null;
  stats?: ItemStatLine[] | null;
  description?: string | null;
  sellPriceGold?: number | null;
  headerAside?: ReactNode;
  meta?: ReactNode;
  footer?: ReactNode;
  actions?: ReactNode;
};

type StoreItemSectionProps = {
  title: string;
  items: StoreItemCardView[];
  emptyMessage: string;
  showSellPrice?: boolean;
};

export default function StoreItemSection({
  title,
  items,
  emptyMessage,
  showSellPrice = false,
}: StoreItemSectionProps) {
  return (
    <section className="shop-section">
      <h2 className="title-font shop-section-title">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-[color:var(--ink-soft)]">{emptyMessage}</p>
      ) : (
        <div className="shop-grid">
          {items.map((item, index) => (
            <ItemCard
              key={item.id ?? `${item.name}-${index}`}
              variant="shop"
              name={item.name}
              qualityBadge={item.qualityBadge}
              qualityLabel={item.qualityLabel}
              quantity={item.quantity ?? undefined}
              stats={item.stats ?? undefined}
              description={item.description}
              sellPriceGold={item.sellPriceGold}
              showSellPrice={showSellPrice}
              headerAside={item.headerAside}
              meta={item.meta}
              footer={item.footer}
              actions={item.actions}
            />
          ))}
        </div>
      )}
    </section>
  );
}
