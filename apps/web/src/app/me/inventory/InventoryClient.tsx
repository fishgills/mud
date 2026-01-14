'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { InventoryItem, InventoryModel } from '@mud/inventory';
import { useGameEvents } from '../../lib/use-game-events';

type Notice = { tone: 'success' | 'error'; message: string };

type ItemActionResponse = {
  success: boolean;
  message?: string;
  data?: {
    item?: {
      name?: string | null;
    } | null;
  };
};

type PendingAction = { type: 'equip' | 'unequip'; id: number } | null;

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const withBasePath = (path: string) =>
  basePath && basePath !== '/' ? `${basePath}${path}` : path;

const SectionDivider = () => (
  <div className="section-divider" aria-hidden="true">
    <svg
      className="divider-icon"
      viewBox="0 0 24 24"
      role="img"
      aria-label="Crossed blades"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 4l4 4" />
      <path d="M4 5l3 3" />
      <path d="M9 9l-2 2" />
      <path d="M19 4l-4 4" />
      <path d="M20 5l-3 3" />
      <path d="M15 9l2 2" />
      <path d="M7 13l10 6" />
      <path d="M17 13l-10 6" />
    </svg>
  </div>
);

const parseActionResponse = async (
  response: Response,
): Promise<ItemActionResponse> => {
  const data = (await response.json().catch(() => null)) as
    | ItemActionResponse
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
  return data as ItemActionResponse;
};

const resolveItemLabel = (item: InventoryItem) => {
  if (item.qualityLabel && item.name) {
    return `${item.qualityLabel} ${item.name}`;
  }
  return item.name || 'item';
};

export default function InventoryClient({
  inventory,
}: {
  inventory: InventoryModel;
}) {
  const router = useRouter();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);

  const handleInventoryEvent = useCallback(() => {
    router.refresh();
  }, [router]);

  useGameEvents(['player:equipment', 'guild.shop.receipt'], handleInventoryEvent);

  const handleEquip = async (item: InventoryItem) => {
    const playerItemId = item.id;
    if (typeof playerItemId !== 'number') {
      setNotice({ tone: 'error', message: 'Missing inventory item.' });
      return;
    }
    const slot = item.allowedSlots?.[0];
    if (!slot) {
      setNotice({ tone: 'error', message: 'This item cannot be equipped.' });
      return;
    }
    setNotice(null);
    setPending({ type: 'equip', id: playerItemId });
    try {
      const response = await fetch(withBasePath('/api/inventory/equip'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ playerItemId, slot }),
      });
      const data = await parseActionResponse(response);
      if (!data.success) {
        setNotice({
          tone: 'error',
          message: data.message ?? 'Equip failed.',
        });
        return;
      }
      const name = data.data?.item?.name ?? resolveItemLabel(item);
      setNotice({ tone: 'success', message: `Equipped ${name}.` });
      router.refresh();
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Equip failed.',
      });
    } finally {
      setPending(null);
    }
  };

  const handleUnequip = async (item: InventoryItem) => {
    const playerItemId = item.id;
    if (typeof playerItemId !== 'number') {
      setNotice({ tone: 'error', message: 'Missing inventory item.' });
      return;
    }
    setNotice(null);
    setPending({ type: 'unequip', id: playerItemId });
    try {
      const response = await fetch(withBasePath('/api/inventory/unequip'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ playerItemId }),
      });
      const data = await parseActionResponse(response);
      if (!data.success) {
        setNotice({
          tone: 'error',
          message: data.message ?? 'Unequip failed.',
        });
        return;
      }
      const name = data.data?.item?.name ?? resolveItemLabel(item);
      setNotice({ tone: 'success', message: `Unequipped ${name}.` });
      router.refresh();
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Unequip failed.',
      });
    } finally {
      setPending(null);
    }
  };

  const isPending = pending !== null;

  return (
    <div className="flex flex-col gap-6">
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

      <SectionDivider />

      <section className="inventory-section">
        <h2 className="title-font inventory-section-title">Equipped Gear</h2>
        <div className="inventory-grid">
          {inventory.equippedSlots.map((slot) => (
            <div key={slot.key} className="inventory-slot">
              <span className="inventory-slot-label">{slot.label}</span>
              {slot.item ? (
                <div className="inventory-item">
                  <span className="inventory-item-name">
                    {slot.item.qualityBadge} {slot.item.qualityLabel}{' '}
                    {slot.item.name}
                  </span>
                  {slot.item.stats.length > 0 && (
                    <div className="inventory-item-stats">
                      {slot.item.stats.map((stat, i) => (
                        <span key={i} className="inventory-stat">
                          {stat.label}: {stat.value}
                        </span>
                      ))}
                    </div>
                  )}
                  {typeof slot.item.id === 'number' ? (
                    <div className="inventory-item-actions">
                      <button
                        className="inventory-button"
                        type="button"
                        onClick={() => handleUnequip(slot.item!)}
                        disabled={isPending}
                      >
                        {pending?.type === 'unequip' &&
                        pending.id === slot.item.id
                          ? 'Unequipping…'
                          : 'Unequip'}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <span className="inventory-empty">Empty</span>
              )}
            </div>
          ))}
        </div>
      </section>

      <SectionDivider />

      <section className="inventory-section">
        <h2 className="title-font inventory-section-title">
          Backpack ({inventory.totalBackpack} items)
        </h2>
        {inventory.backpackItems.length === 0 ? (
          <p className="text-[color:var(--ink-soft)] text-sm italic">
            Your backpack is empty.
          </p>
        ) : (
          <div className="inventory-list">
            {inventory.backpackItems.map((item, index) => (
              <div
                key={item.id ?? `${item.name}-${index}`}
                className="inventory-backpack-item"
              >
                <div className="inventory-item-header">
                  <span className="inventory-item-name">
                    {item.qualityBadge} {item.qualityLabel} {item.name}
                  </span>
                  {item.quantity > 1 && (
                    <span className="inventory-quantity">x{item.quantity}</span>
                  )}
                </div>
                {item.stats.length > 0 && (
                  <div className="inventory-item-stats">
                    {item.stats.map((stat, i) => (
                      <span key={i} className="inventory-stat">
                        {stat.label}: {stat.value}
                      </span>
                    ))}
                  </div>
                )}
                {item.description && (
                  <p className="inventory-item-desc">{item.description}</p>
                )}
                <div className="inventory-item-meta">
                  <span
                    className={
                      item.canEquip
                        ? 'inventory-equippable'
                        : 'inventory-not-equippable'
                    }
                  >
                    {item.canEquip ? 'Equippable' : 'Not equippable'}
                  </span>
                  {item.value && (
                    <span className="inventory-value">{item.value} gold</span>
                  )}
                </div>
                {item.canEquip && typeof item.id === 'number' ? (
                  <div className="inventory-item-actions">
                    <button
                      className="inventory-button"
                      type="button"
                      onClick={() => handleEquip(item)}
                      disabled={isPending}
                    >
                      {pending?.type === 'equip' && pending.id === item.id
                        ? 'Equipping…'
                        : 'Equip'}
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
