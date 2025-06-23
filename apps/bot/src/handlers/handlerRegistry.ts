import { HandlerContext } from './types';

export type EmojiHandler = (ctx: HandlerContext) => Promise<void>;

const registry: Record<string, EmojiHandler> = {};

export function registerHandler(emoji: string, handler: EmojiHandler) {
  registry[emoji] = handler;
}

export function getHandler(emoji: string): EmojiHandler | undefined {
  return registry[emoji];
}

export function getAllHandlers(): Record<string, EmojiHandler> {
  return registry;
}
