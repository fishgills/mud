import { COMMANDS } from '../commands';

const HQ_EXIT_GUIDANCE = `The HQ is a safe zone. Use "${COMMANDS.GUILD} return" or "${COMMANDS.GUILD} random" to head back into the world.`;

export function buildHqBlockedMessage(command?: string): string {
  const prefix = command
    ? `You cannot use ${command} inside HQ.`
    : 'This action is disabled inside HQ.';
  return `${prefix} ${HQ_EXIT_GUIDANCE}`;
}

export { HQ_EXIT_GUIDANCE };
