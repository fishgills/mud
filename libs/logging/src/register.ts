import fs from 'node:fs';
import path from 'node:path';
import winston from 'winston';

const globalAny = globalThis as typeof globalThis & {
  __mudLoggerInstance?: winston.Logger;
  __mudLoggerPatched?: boolean;
  __mudLoggerHandlersRegistered?: boolean;
};

const splatKey = Symbol.for('splat');

// Track last line-trim to avoid excessive I/O
const lastTrimTime = new Map<string, number>();

// Helper to trim file to max lines
function trimFileToMaxLines(filename: string, maxLines: number) {
  try {
    if (fs.existsSync(filename)) {
      const now = Date.now();
      const lastTrim = lastTrimTime.get(filename) || 0;
      // Only trim every 5 seconds to reduce I/O
      if (now - lastTrim < 5000) {
        return;
      }
      lastTrimTime.set(filename, now);

      const content = fs.readFileSync(filename, 'utf-8');
      const lines = content.split('\n');
      if (lines.length > maxLines) {
        const trimmed = lines.slice(-maxLines).join('\n');
        fs.writeFileSync(filename, trimmed);
      }
    }
  } catch {
    // ignore errors in trimming
  }
}

let sharedLogger: winston.Logger;

if (globalAny.__mudLoggerInstance) {
  sharedLogger = globalAny.__mudLoggerInstance;
} else {
  const enableFileLogging =
    process.env.LOG_TO_FILE === 'true' ||
    (process.env.LOG_TO_FILE !== 'false' &&
      process.env.NODE_ENV !== 'production');

  const cwd = process.cwd();
  const rawName =
    process.env.LOG_SERVICE_NAME ||
    process.env.SERVICE_NAME ||
    process.env.npm_package_name ||
    path.basename(cwd) ||
    'app';
  // Clean up service name: remove @ prefix, replace / with -, sanitize
  const serviceName = rawName
    .toLowerCase()
    .replace(/^@/, '')
    .replace(/\//g, '-')
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '');

  // Use a shared logs directory at the workspace root (mud/logs) instead of per-service
  let logDir: string;
  if (process.env.LOG_DIR) {
    logDir = process.env.LOG_DIR;
  } else {
    // Try to find workspace root by looking for turbo.json or yarn.lock
    let searchDir = cwd;
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
    logDir = found ? path.join(searchDir, 'logs') : path.join(cwd, 'logs');
  }
  logDir = path.resolve(logDir);

  if (enableFileLogging) {
    try {
      fs.mkdirSync(logDir, { recursive: true });
      // Clear service-specific error log and shared combined log on startup
      const errorLogPath = path.join(logDir, `${serviceName}-error.log`);
      const combinedLogPath = path.join(logDir, 'mud-combined.log');
      if (fs.existsSync(errorLogPath)) {
        fs.writeFileSync(errorLogPath, '');
      }
      // Only clear the shared combined log if this is the first service (to avoid race conditions)
      // We detect this by checking if the file already exists and has content
      if (!fs.existsSync(combinedLogPath)) {
        fs.writeFileSync(combinedLogPath, '');
      }
    } catch {
      // ignore failures, console transport will still work
    }
  }

  const { combine, timestamp, errors, splat, printf, colorize } =
    winston.format;

  const serializeMeta = (info: winston.Logform.TransformableInfo) => {
    const meta: Record<string, unknown> = {};
    for (const key of Reflect.ownKeys(info)) {
      if (typeof key === 'symbol') {
        if (key === splatKey) {
          continue;
        }
        meta[key.toString()] = (info as Record<PropertyKey, unknown>)[key];
        continue;
      }

      if (
        key === 'level' ||
        key === 'timestamp' ||
        key === 'message' ||
        key === 'stack' ||
        key === 'context' ||
        key === 'label' ||
        key === 'service'
      ) {
        continue;
      }

      meta[key] = (info as Record<PropertyKey, unknown>)[key];
    }

    const context =
      (info.context as string | undefined) ||
      (info.label as string | undefined) ||
      (info.service as string | undefined);

    return { context, meta };
  };

  const consoleFormat = combine(
    colorize(),
    timestamp(),
    errors({ stack: true }),
    splat(),
    printf((info) => {
      const { timestamp: ts, level, message, stack } = info;
      const { context, meta } = serializeMeta(info);
      const ctxPrefix = context ? `[${context}] ` : '';
      const metaKeys = Object.keys(meta);
      const metaSuffix = metaKeys.length > 0 ? ` ${JSON.stringify(meta)}` : '';
      const payload = stack && typeof stack === 'string' ? stack : message;
      return `${ts} ${level}: ${ctxPrefix}${payload}${metaSuffix}`;
    }),
  );

  const fileFormat = combine(
    timestamp(),
    errors({ stack: true }),
    splat(),
    printf((info) => {
      const { timestamp: ts, level, message, stack } = info;
      const { context, meta } = serializeMeta(info);
      const ctxPrefix = context ? `[${context}] ` : '';
      const metaKeys = Object.keys(meta);
      const metaSuffix = metaKeys.length > 0 ? ` ${JSON.stringify(meta)}` : '';
      const payload = stack && typeof stack === 'string' ? stack : message;
      return `${ts} ${level.toUpperCase()}: ${ctxPrefix}${payload}${metaSuffix}`;
    }),
  );

  const transports: winston.transport[] = [
    new winston.transports.Console({
      level: process.env.LOG_LEVEL || 'info',
      format: consoleFormat,
    }),
  ];

  if (enableFileLogging) {
    transports.push(
      new winston.transports.File({
        filename: path.join(logDir, `${serviceName}-error.log`),
        level: 'error',
        maxsize: 10 * 1024 * 1024,
        maxFiles: 5,
        format: fileFormat,
      }),
    );
    const combinedLogPath = path.join(logDir, 'mud-combined.log');
    const combinedTransport = new winston.transports.File({
      filename: combinedLogPath,
      level: process.env.LOG_LEVEL || 'info',
      maxsize: 50 * 1024 * 1024,
      maxFiles: 1,
      format: fileFormat,
    });
    // Wrap the log method to trim file to 500 lines
    const fileTransport = combinedTransport as unknown as {
      log?: (
        info: winston.Logform.TransformableInfo,
        callback?: () => void,
      ) => void;
    };
    const originalLog = fileTransport.log;
    if (originalLog) {
      fileTransport.log = function (
        info: winston.Logform.TransformableInfo,
        callback?: () => void,
      ) {
        originalLog.call(this, info, () => {
          trimFileToMaxLines(combinedLogPath, 500);
          callback?.();
        });
      };
    }
    transports.push(combinedTransport);
  }

  sharedLogger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    defaultMeta: {
      service: serviceName,
      environment: process.env.NODE_ENV || 'development',
    },
    format: combine(errors({ stack: true }), splat(), timestamp()),
    transports,
    exitOnError: false,
  });

  globalAny.__mudLoggerInstance = sharedLogger;
}

if (!globalAny.__mudLoggerPatched) {
  patchConsole(sharedLogger);
  globalAny.__mudLoggerPatched = true;
}

if (!globalAny.__mudLoggerHandlersRegistered) {
  registerProcessHandlers(sharedLogger);
  globalAny.__mudLoggerHandlersRegistered = true;
}

export const logger = sharedLogger;

export const createLogger = (
  context: string,
  meta: Record<string, unknown> = {},
) => sharedLogger.child({ context, ...meta });

export const setLogLevel = (level: string) => {
  sharedLogger.level = level;
  for (const transport of sharedLogger.transports) {
    transport.level = level;
  }
};

export default logger;

function stringify(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.stack || value.message;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function patchConsole(target: winston.Logger) {
  const original = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: console.debug
      ? console.debug.bind(console)
      : console.log.bind(console),
  } as const;

  console.log = (...args: unknown[]) => {
    try {
      target.info(args.map(stringify).join(' '));
    } catch (err) {
      original.log(...(args as Parameters<typeof original.log>));
    }
  };

  console.info = (...args: unknown[]) => {
    console.log(...args);
  };

  console.warn = (...args: unknown[]) => {
    try {
      target.warn(args.map(stringify).join(' '));
    } catch (err) {
      original.warn(...(args as Parameters<typeof original.warn>));
    }
  };

  console.error = (...args: unknown[]) => {
    try {
      const [first, ...rest] = args;
      if (first instanceof Error) {
        target.error(first.message, {
          stack: first.stack,
          extra: rest.map(stringify),
        });
      } else {
        target.error(args.map(stringify).join(' '));
      }
    } catch (err) {
      original.error(...(args as Parameters<typeof original.error>));
    }
  };

  console.debug = (...args: unknown[]) => {
    try {
      target.debug(args.map(stringify).join(' '));
    } catch (err) {
      original.debug(...(args as Parameters<typeof original.debug>));
    }
  };
}

function registerProcessHandlers(target: winston.Logger) {
  process.on('uncaughtException', (err) => {
    try {
      target.error('uncaughtException', {
        stack: err instanceof Error ? err.stack : undefined,
        message: err instanceof Error ? err.message : String(err),
      });
    } catch {
      // ignore
    }
  });

  process.on('unhandledRejection', (reason) => {
    try {
      target.error('unhandledRejection', { reason: stringify(reason) });
    } catch {
      // ignore
    }
  });
}
