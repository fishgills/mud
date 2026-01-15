'use client';

import { withBasePath } from './base-path';

export type StreamEventPayload = {
  type?: string;
  event?: { eventType?: string };
  message?: string;
  timestamp?: string;
};

export type StreamStatus = 'idle' | 'connected' | 'error';
export type StreamListener = (eventName: string, payload: StreamEventPayload) => void;
export type StreamStatusListener = (status: StreamStatus, errorMessage: string | null) => void;

class SharedEventStream {
  private source: EventSource | null = null;
  private listeners = new Set<StreamListener>();
  private statusListeners = new Set<StreamStatusListener>();
  private status: StreamStatus = 'idle';
  private errorMessage: string | null = null;
  private refCount = 0;

  subscribe(listener: StreamListener): () => void {
    this.listeners.add(listener);
    this.refCount += 1;
    this.ensureSource();
    return () => {
      this.listeners.delete(listener);
      this.refCount = Math.max(0, this.refCount - 1);
      if (this.refCount === 0) {
        this.teardown();
      }
    };
  }

  subscribeStatus(listener: StreamStatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status, this.errorMessage);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  private ensureSource() {
    if (this.source || typeof window === 'undefined') {
      return;
    }

    const url = withBasePath('/api/events');
    const source = new EventSource(url);
    this.source = source;

    source.onopen = () => {
      this.updateStatus('connected', null);
      console.info('[web-events] connected', { url });
    };
    source.onerror = (error) => {
      this.updateStatus('error', 'Event stream connection error.');
      console.warn('[web-events] connection error', { url, error });
    };

    source.onmessage = (event) => {
      this.emit(event.type, event.data);
    };

    source.addEventListener('ready', (event) => {
      this.emit(event.type, (event as MessageEvent).data);
    });
  }

  private emit(eventName: string, data: string) {
    if (!data) return;
    let payload: StreamEventPayload;
    try {
      payload = JSON.parse(data) as StreamEventPayload;
    } catch {
      payload = { message: data };
    }

    for (const listener of this.listeners) {
      listener(eventName, payload);
    }
  }

  private updateStatus(status: StreamStatus, errorMessage: string | null) {
    this.status = status;
    this.errorMessage = errorMessage;
    for (const listener of this.statusListeners) {
      listener(status, errorMessage);
    }
  }

  private teardown() {
    if (!this.source) {
      return;
    }
    this.source.close();
    this.source = null;
    this.updateStatus('idle', null);
  }
}

const globalForEventStream = globalThis as typeof globalThis & {
  __sharedEventStream?: SharedEventStream;
};

export const getSharedEventStream = (): SharedEventStream => {
  if (!globalForEventStream.__sharedEventStream) {
    globalForEventStream.__sharedEventStream = new SharedEventStream();
  }
  return globalForEventStream.__sharedEventStream;
};
