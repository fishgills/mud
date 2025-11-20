import {
  ConsoleLogger,
  type ConsoleLoggerOptions,
  type LogLevel,
} from '@nestjs/common';

const baseOptions: ConsoleLoggerOptions = {
  colors: false,
  timestamp: false,
  prefix: '',
};

/**
 * PlainConsoleLogger removes ANSI colors and timestamp metadata from NestJS
 * logs so our GKE aggregators don't need to strip them. It still honors the
 * standard log level + context output.
 */
export class PlainConsoleLogger extends ConsoleLogger {
  constructor(context?: string, options: ConsoleLoggerOptions = {}) {
    super(context ?? '', {
      ...baseOptions,
      ...options,
      colors: false,
      timestamp: false,
    });
  }

  protected getTimestamp(): string {
    return '';
  }

  protected formatPid(_pid: number): string {
    return '';
  }

  protected formatTimestampDiff(_timestampDiff: number): string {
    return '';
  }

  protected formatMessage(
    logLevel: LogLevel,
    message: unknown,
    _pidMessage: string,
    _formattedLogLevel: string,
    contextMessage: string = '',
    _timestampDiff: string,
  ): string {
    const output = this.stringifyMessage(message, logLevel);
    const contextPart = contextMessage ?? '';
    const paddedContext = contextPart ? `${contextPart}` : '';
    return `${logLevel.toUpperCase()} ${paddedContext}${output}\n`;
  }
}
