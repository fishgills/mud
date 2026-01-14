'use client';

import { useEffect } from 'react';
import { withBasePath } from './base-path';

type GameEventPayload = {
  type?: string;
  event?: { eventType?: string };
  message?: string;
  timestamp?: string;
};

type GameEventHandler = (payload: GameEventPayload, eventName: string) => void;


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
    const requestedTypes = new Set(eventTypes);
    const types = requestedTypes.size
      ? [...requestedTypes, 'message']
      : ['message'];

    const onEvent = (event: MessageEvent) => {
      if (!event?.data) return;
      try {
        const payload = JSON.parse(event.data) as GameEventPayload;
        const payloadEvent =
          payload.event?.eventType ?? payload.type ?? event.type;
        const shouldHandle =
          requestedTypes.size === 0 ||
          requestedTypes.has(event.type) ||
          (payloadEvent ? requestedTypes.has(payloadEvent) : false);
        if (shouldHandle) {
          console.info('[web-events] received', {
            eventName: event.type,
            payloadEvent,
          });
          handler(payload, event.type);
        }
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
