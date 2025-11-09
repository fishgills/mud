import fs from 'node:fs';
import path from 'node:path';
import pino, {
  multistream,
  type DestinationStream,
  type Level,
  type Logger as PinoLogger,
  type StreamEntry,
} from 'pino';
import pretty from 'pino-pretty';

type GlobalWithLogger = typeof globalThis & {
  __mudLoggerInstance?: PinoLogger;
  __mudLoggerPatched?: boolean;
  __mudLoggerHandlersRegistered?: boolean;
};

const globalAny = globalThis as GlobalWithLogger;

function trimFileToMaxLines(filename: string, maxLines: number) {
  try {
    if (!fs.existsSync(filename)) return;
    const content = fs.readFileSync(filename, 'utf-8');
    const lines = content.split('\n');
    if (lines.length > maxLines) {
      const trimmed = lines.slice(-maxLines).join('\n');
      fs.writeFileSync(filename, trimmed);
    }
  } catch {
    // ignore trimming errors
  }
}

function detectWorkspaceLogDir(cwd: string): string {
  if (process.env.LOG_DIR) {
    return path.resolve(process.env.LOG_DIR);
  }

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
  return path.resolve(
    found ? path.join(searchDir, 'logs') : path.join(cwd, 'logs'),
  );
}

function deriveServiceName(cwd: string): string {
  const rawName =
    process.env.LOG_SERVICE_NAME ||
    process.env.SERVICE_NAME ||
    process.env.npm_package_name ||
    path.basename(cwd) ||
    'app';

  return (
    rawName
      .toLowerCase()
      .replace(/^@/, '')
      .replace(/\//g, '-')
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'app'
  );
}

const runningInKubernetes = Boolean(process.env.KUBERNETES_SERVICE_HOST);
const shouldPatchConsole = process.env.LOG_PATCH_CONSOLE === 'true';
const allowedLevels: Level[] = [
  'fatal',
  'error',
  'warn',
  'info',
  'debug',
  'trace',
];

const normalizeLevel = (value?: string): Level => {
  if (!value) return 'debug';
  const candidate = value.toLowerCase() as Level;
  return allowedLevels.includes(candidate) ? candidate : 'debug';
};

const resolvedLogLevel = normalizeLevel(process.env.LOG_LEVEL);
const enableFileLogging = !runningInKubernetes;

let sharedLogger: PinoLogger;

if (globalAny.__mudLoggerInstance) {
  sharedLogger = globalAny.__mudLoggerInstance;
} else {
  const cwd = process.cwd();
  const serviceName = deriveServiceName(cwd);
  const logDir = detectWorkspaceLogDir(cwd);

  const streams: StreamEntry[] = [];
  const shouldPrettyPrint = !runningInKubernetes;

  const consoleStream: DestinationStream = shouldPrettyPrint
    ? createPrettyConsoleStream()
    : process.stdout;
  streams.push({ level: resolvedLogLevel, stream: consoleStream });

  let combinedLogPath: string | null = null;

  if (enableFileLogging) {
    try {
      fs.mkdirSync(logDir, { recursive: true });
      const errorLogPath = path.join(logDir, `${serviceName}-error.log`);
      fs.writeFileSync(errorLogPath, '');
      const errorStream = pino.destination({
        dest: errorLogPath,
        mkdir: true,
        sync: false,
      });
      streams.push({ level: 'error', stream: errorStream });

      if (!runningInKubernetes) {
        combinedLogPath = path.join(logDir, 'mud-combined.log');
        if (!fs.existsSync(combinedLogPath)) {
          fs.writeFileSync(combinedLogPath, '');
        }
        const combinedStream = createCombinedLogStream(combinedLogPath);
        streams.push({ level: resolvedLogLevel, stream: combinedStream });
      }
    } catch {
      // ignore file logging failures; console logging still works
    }
  }

  const destination =
    streams.length === 1 ? streams[0].stream : multistream(streams);

  sharedLogger = pino(
    {
      level: resolvedLogLevel,
      base: {
        service: serviceName,
        environment: process.env.NODE_ENV || 'development',
      },
      timestamp: pino.stdTimeFunctions.isoTime,
      messageKey: 'message',
    },
    destination,
  );

  globalAny.__mudLoggerInstance = sharedLogger;
}

if (shouldPatchConsole && !globalAny.__mudLoggerPatched) {
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
  sharedLogger.level = normalizeLevel(level);
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

function createPrettyConsoleStream(): DestinationStream {
  const prettyStream = pretty({
    colorize: true,
    translateTime: 'yyyy-mm-dd HH:MM:ss',
    ignore: 'pid,hostname',
    messageKey: 'message',
    singleLine: true,
  });
  prettyStream.pipe(process.stdout);
  return {
    write(chunk: string | Buffer) {
      prettyStream.write(chunk);
    },
  } as DestinationStream;
}

function formatCombinedLogLine(raw: string): string {
  const levelLabels: Record<number, string> = {
    10: 'TRACE',
    20: 'DEBUG',
    30: 'INFO',
    40: 'WARN',
    50: 'ERROR',
    60: 'FATAL',
  };

  try {
    const parsed = JSON.parse(raw);
    const timestamp = formatTimestamp(parsed.time ?? new Date().toISOString());
    const levelValue = parsed.level;
    const level =
      typeof levelValue === 'number'
        ? levelLabels[levelValue] || `LVL${levelValue}`
        : String(levelValue || '').toUpperCase() || 'INFO';
    const context = parsed.context ? `[${parsed.context}] ` : '';
    const message = parsed.message ?? parsed.msg ?? '';

    const meta: Record<string, unknown> = { ...parsed };
    delete meta.level;
    delete meta.time;
    delete meta.message;
    delete meta.msg;

    const metaKeys = Object.keys(meta);
    const suffix = metaKeys.length > 0 ? ` ${JSON.stringify(meta)}` : '';

    return `${timestamp} ${level}: ${context}${message}${suffix}`;
  } catch {
    return raw;
  }
}

function formatTimestamp(input: string): string {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return input;
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function createCombinedLogStream(filePath: string): DestinationStream {
  const destination = fs.createWriteStream(filePath, { flags: 'a' });

  return {
    write(chunk: string | Buffer) {
      const payload = chunk.toString().split(/\r?\n/).filter(Boolean);
      for (const line of payload) {
        destination.write(`${formatCombinedLogLine(line)}\n`);
      }
      trimFileToMaxLines(filePath, 500);
    },
  } as DestinationStream;
}

function patchConsole(target: PinoLogger) {
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
      target.info(stringifyArgs(args));
    } catch {
      original.log(...(args as Parameters<typeof original.log>));
    }
  };

  console.info = (...args: unknown[]) => {
    console.log(...args);
  };

  console.warn = (...args: unknown[]) => {
    try {
      target.warn(stringifyArgs(args));
    } catch {
      original.warn(...(args as Parameters<typeof original.warn>));
    }
  };

  console.error = (...args: unknown[]) => {
    try {
      const [first, ...rest] = args;
      if (first instanceof Error) {
        target.error(
          {
            stack: first.stack,
            error: first.message,
            extra: rest.map(stringify),
          },
          first.message,
        );
      } else {
        target.error(stringifyArgs(args));
      }
    } catch {
      original.error(...(args as Parameters<typeof original.error>));
    }
  };

  console.debug = (...args: unknown[]) => {
    try {
      target.debug(stringifyArgs(args));
    } catch {
      original.debug(...(args as Parameters<typeof original.debug>));
    }
  };
}

function stringifyArgs(args: unknown[]): string {
  return args.map(stringify).join(' ');
}

function registerProcessHandlers(target: PinoLogger) {
  process.on('uncaughtException', (err) => {
    try {
      target.error(
        {
          stack: err instanceof Error ? err.stack : undefined,
          error: err instanceof Error ? err.message : String(err),
        },
        'uncaughtException',
      );
    } catch {
      // ignore
    }
  });

  process.on('unhandledRejection', (reason) => {
    try {
      target.error(
        {
          reason:
            reason instanceof Error
              ? reason.stack || reason.message
              : stringify(reason),
        },
        'unhandledRejection',
      );
    } catch {
      // ignore
    }
  });
}
