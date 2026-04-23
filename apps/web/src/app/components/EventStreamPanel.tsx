'use client';

import { useEffect, useRef, useState } from 'react';
import { withBasePath } from '../lib/base-path';
import { getSharedEventStream, type StreamEventPayload } from '../lib/event-stream';

type StreamEntry = {
  id: number;
  eventName: string;
  payloadEvent: string | null;
  message: string | null;
  payload: StreamEventPayload;
  receivedAt: string;
};

type EventStreamPanelProps = {
  enabled: boolean;
};

const MAX_EVENTS = 50;

export default function EventStreamPanel({ enabled }: EventStreamPanelProps) {
  const [entries, setEntries] = useState<StreamEntry[]>([]);
  const [status, setStatus] = useState<'idle' | 'connected' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [open, setOpen] = useState(true);
  const counterRef = useRef(0);
  const diagnosticsRef = useRef(0);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      return;
    }

    const stream = getSharedEventStream();

    const addEntry = (eventName: string, payload: StreamEventPayload) => {
      const payloadEvent = payload.event?.eventType ?? payload.type ?? null;
      const message = payload.message ?? null;
      const receivedAt = new Date().toLocaleTimeString();
      counterRef.current += 1;
      setEntries((prev) => [
        {
          id: counterRef.current,
          eventName,
          payloadEvent,
          message,
          payload,
          receivedAt,
        },
        ...prev,
      ].slice(0, MAX_EVENTS));
    };

    const runDiagnostics = async () => {
      const now = Date.now();
      if (now - diagnosticsRef.current < 5000) {
        return;
      }
      diagnosticsRef.current = now;

      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 2500);
      try {
        const response = await fetch(withBasePath('/api/events?diagnostics=1'), {
          headers: { accept: 'application/json' },
          signal: controller.signal,
        });
        const text = await response.text();
        let reason = text;
        try {
          const data = JSON.parse(text) as { reason?: string };
          if (data?.reason) {
            reason = data.reason;
          }
        } catch {
          // Leave reason as the raw response text.
        }
        const suffix = reason ? `: ${reason}` : '';
        setErrorMessage(
          `Event stream error (${response.status} ${response.statusText})${suffix}`,
        );
      } catch (error) {
        const message =
          error instanceof DOMException && error.name === 'AbortError'
            ? 'Event stream diagnostics timed out.'
            : 'Event stream connection error.';
        setErrorMessage(message);
      } finally {
        window.clearTimeout(timeout);
      }
    };

    const unsubscribe = stream.subscribe((eventName, payload) => {
      addEntry(eventName, payload);
    });

    const unsubscribeStatus = stream.subscribeStatus((nextStatus, message) => {
      setStatus(nextStatus);
      setErrorMessage(message);
      if (nextStatus === 'error') {
        void runDiagnostics();
      }
    });

    return () => {
      unsubscribe();
      unsubscribeStatus();
    };
  }, [enabled]);

  if (!enabled) {
    return null;
  }

  const dotClass =
    status === 'connected'
      ? 'events-dot events-dot-connected'
      : status === 'error'
        ? 'events-dot events-dot-error'
        : 'events-dot events-dot-idle';

  return (
    <div className="events-panel">
      <button
        className="events-hdr"
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="events-title">LIVE EVENTS</span>
        <div className={dotClass} />
      </button>
      {open && (
        <div className="events-body">
          {errorMessage ? (
            <div className="event-line" style={{ color: 'var(--error)' }}>{errorMessage}</div>
          ) : null}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
            <button
              type="button"
              className="btn btn-xs"
              onClick={() => setEntries([])}
            >
              Clear
            </button>
          </div>
          {entries.length === 0 ? (
            <div className="event-line" style={{ fontStyle: 'italic' }}>No events yet.</div>
          ) : (
            entries.map((entry) => (
              <div key={entry.id} className="event-line">
                <span className="event-line-type">{entry.payloadEvent ?? entry.eventName}</span>
                {entry.message ? ` — ${entry.message}` : null}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
