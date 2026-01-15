'use client';

import { useEffect } from 'react';
import { getSharedEventStream } from './event-stream';

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

    const requestedTypes = new Set(eventTypes);
    const stream = getSharedEventStream();

    const onEvent = (eventName: string, payload: GameEventPayload) => {
      const payloadEvent = payload.event?.eventType ?? payload.type ?? eventName;
      const shouldHandle =
        requestedTypes.size === 0 ||
        requestedTypes.has(eventName) ||
        (payloadEvent ? requestedTypes.has(payloadEvent) : false);
      if (shouldHandle) {
        console.info('[web-events] received', { eventName, payloadEvent });
        handler(payload, eventName);
      }
    };

    const unsubscribe = stream.subscribe(onEvent);

    return () => {
      unsubscribe();
    };
  }, [eventTypes.join('|'), handler]);
};
