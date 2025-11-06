import type { LoggerService, LogLevel } from '@nestjs/common';
import type winston from 'winston';
import { createLogger, logger, setLogLevel } from './register.js';

const levelMap: Record<LogLevel, string> = {
  log: 'info',
  error: 'error',
  warn: 'warn',
  debug: 'debug',
  verbose: 'verbose',
  fatal: 'error',
};

const severityOrder: LogLevel[] = [
  'fatal',
  'error',
  'warn',
  'log',
  'debug',
  'verbose',
];

export class NestWinstonLogger implements LoggerService {
  private readonly base: winston.Logger;

  constructor(private readonly defaultContext?: string) {
    this.base = defaultContext ? createLogger(defaultContext) : logger;
  }

  log(message: unknown, context?: string) {
    this.child(context).info(this.stringify(message));
  }

  error(message: unknown, trace?: unknown, context?: string) {
    const child = this.child(context);
    if (trace instanceof Error) {
      child.error(this.stringify(message ?? trace.message), {
        stack: trace.stack,
      });
      return;
    }
    if (typeof trace === 'string' && trace.length > 0) {
      child.error(this.stringify(message), { trace });
      return;
    }
    child.error(this.stringify(message), trace ? { trace } : undefined);
  }

  warn(message: unknown, context?: string) {
    this.child(context).warn(this.stringify(message));
  }

  debug(message: unknown, context?: string) {
    this.child(context).debug(this.stringify(message));
  }

  verbose(message: unknown, context?: string) {
    const child = this.child(context);
    const maybeVerbose = child.verbose as undefined | ((msg: string) => void);
    if (typeof maybeVerbose === 'function') {
      maybeVerbose.call(child, this.stringify(message));
    } else {
      child.debug(this.stringify(message));
    }
  }

  fatal?(message: unknown, trace?: unknown, context?: string): void {
    this.error(message, trace, context);
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

  private child(context?: string): winston.Logger {
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
