import { HandlerContext } from './types';

export type CommandHandler = (ctx: HandlerContext) => Promise<void>;

const registry: Record<string, CommandHandler> = {};

export function registerHandler(command: string, handler: CommandHandler) {
  registry[command] = handler;
}

export function getHandler(command: string): CommandHandler | undefined {
  return registry[command];
}

export function getAllHandlers(): Record<string, CommandHandler> {
  return registry;
}
