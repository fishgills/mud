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

    const handlePayload = (eventName: string, data: string) => {
      try {
        const payload = JSON.parse(data) as StreamEventPayload;
        addEntry(eventName, payload);
      } catch {
        addEntry(eventName, { message: data });
      }
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

  const statusLabel =
    status === 'connected'
      ? 'Connected'
      : status === 'error'
        ? 'Disconnected'
        : 'Connecting';

  return (
    <details className="event-stream-panel">
      <summary className="event-stream-summary">
        <span className="event-stream-title">Event Stream</span>
        <span className={`event-stream-status event-stream-status-${status}`}>
          {statusLabel}
        </span>
      </summary>
      <div className="event-stream-body">
        {errorMessage ? (
          <div className="event-stream-error">{errorMessage}</div>
        ) : null}
        <div className="event-stream-actions">
          <button
            type="button"
            className="event-stream-clear"
            onClick={() => setEntries([])}
          >
            Clear
          </button>
        </div>
        {entries.length === 0 ? (
          <div className="event-stream-empty">No events yet.</div>
        ) : (
          <div className="event-stream-list">
            {entries.map((entry) => (
              <div key={entry.id} className="event-stream-entry">
                <div className="event-stream-entry-meta">
                  <span>
                    {entry.receivedAt} · {entry.payloadEvent ?? entry.eventName}
                  </span>
                  {entry.message ? (
                    <span className="event-stream-entry-message">
                      {entry.message}
                    </span>
                  ) : null}
                </div>
                <pre className="event-stream-entry-payload">
                  {JSON.stringify(entry.payload, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}
