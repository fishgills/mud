import type { LoggerService, LogLevel } from '@nestjs/common';
import type { Logger as PinoLogger, LevelWithSilent } from 'pino';
import { createLogger, logger, setLogLevel } from './register.js';

const levelMap: Record<LogLevel, LevelWithSilent> = {
  log: 'info',
  error: 'error',
  warn: 'warn',
  debug: 'debug',
  verbose: 'trace',
  fatal: 'fatal',
};

const severityOrder: LogLevel[] = [
  'fatal',
  'error',
  'warn',
  'log',
  'debug',
  'verbose',
];

export class NestLogger implements LoggerService {
  private readonly base: PinoLogger;

  constructor(private readonly defaultContext?: string) {
    this.base = defaultContext ? createLogger(defaultContext) : logger;
  }

  log(message: unknown, context?: string) {
    this.child(context).info(this.stringify(message));
  }

  error(message: unknown, trace?: unknown, context?: string) {
    const child = this.child(context);
    if (trace instanceof Error) {
      child.error(
        {
          stack: trace.stack,
        },
        this.stringify(message ?? trace.message),
      );
      return;
    }
    if (typeof trace === 'string' && trace.length > 0) {
      child.error({ trace }, this.stringify(message));
      return;
    }
    child.error(this.stringify(message));
  }

  warn(message: unknown, context?: string) {
    this.child(context).warn(this.stringify(message));
  }

  debug(message: unknown, context?: string) {
    this.child(context).debug(this.stringify(message));
  }

  verbose(message: unknown, context?: string) {
    this.child(context).trace(this.stringify(message));
  }

  fatal?(message: unknown, trace?: unknown, context?: string): void {
    if (trace instanceof Error) {
      this.child(context).fatal(
        {
          stack: trace.stack,
        },
        this.stringify(message ?? trace.message),
      );
      return;
    }
    this.child(context).fatal(this.stringify(message));
  }

  setLogLevels?(levels: LogLevel[]): void {
    if (!levels || levels.length === 0) return;
    const normalized = [...levels];
    normalized.sort(
      (a, b) => severityOrder.indexOf(a) - severityOrder.indexOf(b),
    );
    const highest = normalized[0];
    const mapped = levelMap[highest] || 'info';
    setLogLevel(mapped);
  }

  private child(context?: string): PinoLogger {
    if (!context) {
      return this.base;
    }
    return this.base.child({ context });
  }

  private stringify(value: unknown): string {
    if (typeof value === 'string') return value;
    if (value instanceof Error) return value.stack || value.message;
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
}
