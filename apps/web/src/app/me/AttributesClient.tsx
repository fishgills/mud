'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGameEvents } from '../lib/use-game-events';
import { withBasePath } from '../lib/base-path';

type AttributeField = { label: string; value: string };

type Props = {
  fields: AttributeField[];
  skillPoints: number;
};

const LABEL_TO_ATTRIBUTE: Record<string, 'strength' | 'agility' | 'health'> = {
  Strength: 'strength',
  Agility: 'agility',
  Vitality: 'health',
};

export default function AttributesClient({ fields, skillPoints }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => router.refresh(), [router]);
  useGameEvents(['player:stats'], refresh);

  const handleSpend = async (label: string) => {
    const attribute = LABEL_TO_ATTRIBUTE[label];
    if (!attribute || pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(withBasePath('/api/character/spend-skill-point'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ attribute }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(data?.message ?? 'Failed to spend skill point.');
      } else {
        router.refresh();
      }
    } catch {
      setError('Failed to spend skill point.');
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <div className="stat-grid">
        {fields.map((field) => (
          <div key={field.label} className="stat-field">
            <span className="stat-key">{field.label}</span>
            <span className="stat-val">{field.value}</span>
            {skillPoints > 0 && LABEL_TO_ATTRIBUTE[field.label] ? (
              <button
                className="btn btn-xs"
                disabled={pending}
                onClick={() => handleSpend(field.label)}
                aria-label={`Increase ${field.label}`}
              >
                +
              </button>
            ) : null}
          </div>
        ))}
      </div>
      {error ? <p style={{ fontFamily: "'VT323',monospace", fontSize: 16, color: 'var(--error)' }}>{error}</p> : null}
    </>
  );
}
