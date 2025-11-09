import { HandlerContext } from './types';
import { createLogger } from '@mud/logging';

const handlerLog = createLogger('slack:handlers');

export type CommandHandler = (ctx: HandlerContext) => Promise<void>;

const registry: Record<string, CommandHandler> = {};

export function registerHandler(command: string, handler: CommandHandler) {
  handlerLog.info(
    { command },
    'Registering handler for command',
  );
  registry[command] = handler;
}

export function getHandler(command: string): CommandHandler | undefined {
  return registry[command];
}

export function getAllHandlers(): Record<string, CommandHandler> {
  return registry;
}
