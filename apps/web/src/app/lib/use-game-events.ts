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
const resolveBasePath = () => {
  if (basePath && basePath !== '/') {
    return basePath;
  }
  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname;
    if (pathname.startsWith('/www')) {
      return '/www';
    }
  }
  return '';
};
const withBasePath = (path: string) => {
  const resolved = resolveBasePath();
  return resolved ? `${resolved}${path}` : path;
};

export const useGameEvents = (
  eventTypes: string[],
  handler: GameEventHandler,
) => {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const url = withBasePath('/api/events');
    const source = new EventSource(url);
    source.onopen = () => {
      console.info('[web-events] connected', { url });
    };
    source.onerror = (error) => {
      console.warn('[web-events] connection error', { url, error });
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
