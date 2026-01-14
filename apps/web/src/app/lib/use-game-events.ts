'use client';

import { useEffect } from 'react';

type GameEventPayload = {
  type?: string;
  event?: { eventType?: string };
  message?: string;
  timestamp?: string;
};

type GameEventHandler = (payload: GameEventPayload, eventName: string) => void;

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const withBasePath = (path: string) =>
  basePath && basePath !== '/' ? `${basePath}${path}` : path;

export const useGameEvents = (
  eventTypes: string[],
  handler: GameEventHandler,
) => {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const source = new EventSource(withBasePath('/api/events'));
    source.onopen = () => {
      console.info('[web-events] connected');
    };
    source.onerror = (error) => {
      console.warn('[web-events] connection error', error);
    };
    const types = eventTypes.length ? eventTypes : ['message'];

    const onEvent = (event: MessageEvent) => {
      if (!event?.data) return;
      try {
        const payload = JSON.parse(event.data) as GameEventPayload;
        handler(payload, event.type);
      } catch {
        // Ignore malformed payloads.
      }
    };

    for (const type of types) {
      source.addEventListener(type, onEvent);
    }

    return () => {
      for (const type of types) {
        source.removeEventListener(type, onEvent);
      }
      source.close();
    };
  }, [eventTypes.join('|'), handler]);
};
