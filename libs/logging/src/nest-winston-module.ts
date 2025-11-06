import path from 'node:path';
import fs from 'node:fs';
import {
  WinstonModule,
  utilities as nestWinstonModuleUtilities,
} from 'nest-winston';
import * as winston from 'winston';

/**
 * Format timestamp as local timezone (e.g., "2025-11-06 15:39:13")
 */
function localTimestamp() {
  return winston.format((info) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    info.timestamp = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    return info;
  })();
}

/**
 * Filter out Datadog and other non-essential metadata
 */
function filterMetadata() {
  return winston.format((info) => {
    // Remove Datadog metadata
    delete info.dd;
    delete info.environment;
    // Remove internal Winston symbols
    const symbols = Object.getOwnPropertySymbols(info);
    for (const sym of symbols) {
      delete info[sym as any];
    }
    return info;
  })();
}

/**
 * Create a pre-configured WinstonModule for NestJS applications.
 * This handles transports, formatting, and log levels automatically.
 */
export function createWinstonModuleForRoot(options?: {
  serviceName?: string;
  logDir?: string;
  maxLogSize?: number;
}) {
  const enableFileLogging =
    process.env.LOG_TO_FILE === 'true' ||
    (process.env.LOG_TO_FILE !== 'false' &&
      process.env.NODE_ENV !== 'production');

  const serviceName =
    options?.serviceName ||
    process.env.LOG_SERVICE_NAME ||
    process.env.SERVICE_NAME ||
    process.env.npm_package_name ||
    path.basename(process.cwd()) ||
    'app';

  // Clean up service name
  const cleanServiceName = serviceName
    .toLowerCase()
    .replace(/^@/, '')
    .replace(/\//g, '-')
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '');

  // Determine log directory
  let logDir =
    options?.logDir ||
    process.env.LOG_DIR ||
    (() => {
      let searchDir = process.cwd();
      let found = false;
      for (let i = 0; i < 10; i++) {
        if (
          fs.existsSync(path.join(searchDir, 'turbo.json')) ||
          fs.existsSync(path.join(searchDir, 'yarn.lock'))
        ) {
          found = true;
          break;
        }
        const parent = path.dirname(searchDir);
        if (parent === searchDir) break;
        searchDir = parent;
      }
      return found
        ? path.join(searchDir, 'logs')
        : path.join(process.cwd(), 'logs');
    })();

  logDir = path.resolve(logDir);

  const transports: winston.transport[] = [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.ms(),
        filterMetadata(),
        nestWinstonModuleUtilities.format.nestLike(cleanServiceName, {
          colors: true,
          prettyPrint: true,
          processId: true,
          appName: true,
        }),
      ),
    }),
  ];

  if (enableFileLogging) {
    try {
      fs.mkdirSync(logDir, { recursive: true });
    } catch {
      // ignore, console transport will still work
    }

    // Error log transport
    transports.push(
      new winston.transports.File({
        filename: path.join(logDir, `${cleanServiceName}-error.log`),
        level: 'error',
        maxsize: 10 * 1024 * 1024,
        maxFiles: 5,
        format: winston.format.combine(
          localTimestamp(),
          filterMetadata(),
          winston.format.errors({ stack: true }),
          winston.format.json(),
        ),
      }),
    );

    // Combined log transport
    transports.push(
      new winston.transports.File({
        filename: path.join(logDir, 'mud-combined.log'),
        level:
          process.env.LOG_LEVEL ||
          (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
        maxsize: 50 * 1024 * 1024,
        maxFiles: 1,
        format: winston.format.combine(
          localTimestamp(),
          filterMetadata(),
          winston.format.errors({ stack: true }),
          winston.format.json(),
        ),
      }),
    );
  }

  return [
    WinstonModule.forRoot({
      transports,
      level:
        process.env.LOG_LEVEL ||
        (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    }),
  ];
}
