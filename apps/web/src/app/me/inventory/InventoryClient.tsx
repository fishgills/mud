'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  EquipmentSlotKey,
  EquippedSlot,
  InventoryItem,
  InventoryModel,
} from '@mud/inventory';
import BackpackList, {
  type BackpackListItem,
} from '../../components/BackpackList';
import ItemCard from '../../components/ItemCard';
import { useGameEvents } from '../../lib/use-game-events';
import { withBasePath } from '../../lib/base-path';

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

const normalizeRarity = (qualityLabel: string | null | undefined): string => {
  const q = qualityLabel?.toLowerCase() ?? '';
  if (q.includes('legendary')) return 'legendary';
  if (q.includes('epic')) return 'epic';
  if (q.includes('rare')) return 'rare';
  return 'common';
};

const PixelDivider = () => (
  <div className="divider" aria-hidden="true">
    <div className="divider-line" />
    <span className="divider-glyph">⚔</span>
    <div className="divider-line" />
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

const resolveSellPrice = (value: number | null | undefined) => {
  if (typeof value !== 'number') return null;
  return Math.max(1, Math.floor(value * 0.5));
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

  useGameEvents(
    ['player:equipment', 'guild.shop.receipt', 'run:end'],
    handleInventoryEvent,
  );

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
  const slotLookup = new Map<EquipmentSlotKey, EquippedSlot>(
    inventory.equippedSlots.map((slot) => [slot.key, slot]),
  );
  const slotLabels: Record<EquipmentSlotKey, string> = {
    head: 'Head',
    chest: 'Chest',
    legs: 'Legs',
    arms: 'Arms',
    weapon: 'Weapon',
  };
  const resolveSlot = (key: EquipmentSlotKey): EquippedSlot =>
    slotLookup.get(key) ?? {
      key,
      label: slotLabels[key],
      item: null,
      isEmpty: true,
    };
  const renderSlot = (slot: EquippedSlot) => {
    const rarity = slot.item ? normalizeRarity(slot.item.qualityLabel) : '';
    const slotClass = `equip-slot${slot.item ? ` has-item rarity-${rarity}` : ''}`;
    return (
      <div key={slot.key} className={slotClass}>
        <span className="slot-label">{slot.label}</span>
        {slot.item ? (
          <ItemCard
            variant="slot"
            name={slot.item.name}
            qualityBadge={slot.item.qualityBadge}
            qualityLabel={slot.item.qualityLabel}
            stats={slot.item.stats}
            sellPriceGold={resolveSellPrice(slot.item.value)}
            actions={
              typeof slot.item.id === 'number' ? (
                <button
                  className="btn btn-xs"
                  type="button"
                  onClick={() => handleUnequip(slot.item!)}
                  disabled={isPending}
                >
                  {pending?.type === 'unequip' && pending.id === slot.item.id
                    ? 'Unequipping…'
                    : 'Unequip'}
                </button>
              ) : null
            }
          />
        ) : (
          <span className="slot-empty">Empty</span>
        )}
      </div>
    );
  };
  const backpackItems: BackpackListItem[] = inventory.backpackItems.map(
    (item) => ({
      id: item.id ?? null,
      name: item.name,
      qualityBadge: item.qualityBadge,
      qualityLabel: item.qualityLabel,
      quantity: item.quantity,
      stats: item.stats,
      description: item.description,
      sellPriceGold: resolveSellPrice(item.value),
      actions:
        item.canEquip && typeof item.id === 'number' ? (
          <button
            className="btn btn-xs btn-primary"
            type="button"
            onClick={() => handleEquip(item)}
            disabled={isPending}
          >
            {pending?.type === 'equip' && pending.id === item.id
              ? 'Equipping…'
              : 'Equip'}
          </button>
        ) : null,
    }),
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {notice ? (
        <div
          className={`notice ${notice.tone === 'success' ? 'notice-success' : 'notice-error'}`}
          role={notice.tone === 'error' ? 'alert' : 'status'}
        >
          {notice.message}
        </div>
      ) : null}

      <PixelDivider />

      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="pixel-h3">Equipped Gear</div>
        <div className="equip-grid">
          <div className="equip-col">
            {renderSlot(resolveSlot('arms'))}
          </div>
          <div className="equip-col">
            {renderSlot(resolveSlot('head'))}
            {renderSlot(resolveSlot('chest'))}
            {renderSlot(resolveSlot('legs'))}
          </div>
          <div className="equip-col">
            {renderSlot(resolveSlot('weapon'))}
          </div>
        </div>
      </section>

      <PixelDivider />

      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="pixel-h3">
          Backpack ({inventory.totalBackpack} items)
        </div>
        <BackpackList items={backpackItems} />
      </section>
    </div>
  );
}
