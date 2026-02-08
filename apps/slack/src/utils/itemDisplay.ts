import { formatQualityLabel } from '@mud/constants';
import type { ItemRecord } from '../dm-client';

export const formatSignedStat = (value: number): string => {
  if (!Number.isFinite(value)) {
    return '0';
  }
  return value >= 0 ? `+${value}` : `${value}`;
};

const normalizeName = (value?: string | null): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export function getItemDisplayName(
  record?: ItemRecord | null,
): string | undefined {
  if (!record) return undefined;
  return (
    normalizeName(record.item?.name) ??
    normalizeName(record.itemName) ??
    normalizeName((record as { name?: string | null }).name)
  );
}

const getRawQuality = (record?: ItemRecord | null): string | undefined => {
  if (!record) return undefined;
  const value =
    (record as { quality?: string | null }).quality ??
    (record.item as { quality?: string | null } | undefined)?.quality ??
    undefined;
  if (!value) return undefined;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : undefined;
};

export function getItemQualityLabel(
  record?: ItemRecord | null,
): string | undefined {
  const raw = getRawQuality(record);
  return raw ? formatQualityLabel(raw) : undefined;
}

export function getItemNameWithQuality(
  record?: ItemRecord | null,
): string | undefined {
  const name = getItemDisplayName(record);
  const quality = getItemQualityLabel(record);
  if (quality && name) return `${quality} ${name}`;
  return name ?? quality;
}

export function buildItemActionMessage(
  action: string,
  record?: ItemRecord | null,
  fallback?: string,
  options?: { suffix?: string },
): string | undefined {
  const nameWithQuality = getItemNameWithQuality(record);
  if (nameWithQuality) {
    const suffix = options?.suffix ? ` ${options.suffix}` : '';
    return `${action} ${nameWithQuality}${suffix}.`;
  }
  return fallback;
}
