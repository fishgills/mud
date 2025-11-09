import type { Logger as SlackLogger } from '@slack/logger';
import { LogLevel } from '@slack/logger';
import type { Logger as PinoLogger } from '@mud/logging';
import type { Level } from 'pino';

const slackToPinoLevel: Record<LogLevel, Level> = {
  [LogLevel.DEBUG]: 'debug',
  [LogLevel.INFO]: 'info',
  [LogLevel.WARN]: 'warn',
  [LogLevel.ERROR]: 'error',
};

const serializeArgs = (args: unknown[]): string => {
  return args
    .map((value) => {
      if (typeof value === 'string') return value;
      if (value instanceof Error) {
        return value.stack || value.message;
      }
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    })
    .join(' ');
};

export const createSlackLogger = (logger: PinoLogger): SlackLogger => {
  let currentLevel: LogLevel = LogLevel.INFO;
  let name = 'slack:bolt';

  const logWith =
    (method: keyof PinoLogger) =>
    (...msg: unknown[]) => {
      const message = serializeArgs(msg);
      if (typeof logger[method] === 'function') {
        (logger[method] as (obj: unknown, msg?: string) => void)(
          { logger: name },
          message,
        );
      } else {
        logger.info({ logger: name }, message);
      }
    };

  return {
    debug: logWith('debug'),
    info: logWith('info'),
    warn: logWith('warn'),
    error: logWith('error'),
    setLevel(level: LogLevel) {
      currentLevel = level;
      const mapped = slackToPinoLevel[level] ?? 'info';
      logger.level = mapped;
    },
    getLevel() {
      return currentLevel;
    },
    setName(value: string) {
      name = value;
    },
  };
};
