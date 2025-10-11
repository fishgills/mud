import { GoogleAuth, IdTokenClient } from 'google-auth-library';

type FetchInit = NonNullable<Parameters<typeof fetch>[1]>;

export interface AuthLogger {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

// Cache IdTokenClient per audience to avoid re-creating on every call
const clientCache = new Map<string, Promise<IdTokenClient>>();
let currentLogger: AuthLogger = console;
let hasLoggedLocalModeNotice = false;

export function setAuthLogger(logger: AuthLogger | null | undefined): void {
  currentLogger = logger ?? console;
}

function serialize(value: unknown): string {
  if (value instanceof Error) {
    return value.stack ? `${value.message}\n${value.stack}` : value.message;
  }
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function isLocalhost(hostname: string): boolean {
  return (
    hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
  );
}

/**
 * Given a URL string, returns the Cloud Run audience (scheme + host).
 * Example: https://my-svc-abc-uc.a.run.app/path -> https://my-svc-abc-uc.a.run.app
 */
export function audienceFromUrl(urlStr: string): string {
  const u = new URL(urlStr);
  return `${u.protocol}//${u.host}`;
}

/** Returns true when running in GCP/Cloud Run. */
export function isRunningInGcp(): boolean {
  const gcpCloudRun = process.env.GCP_CLOUD_RUN;
  const kService = process.env.K_SERVICE;
  const isGcp = gcpCloudRun === 'true' || !!kService;

  // Prefer explicit flag set by our infra, fall back to Cloud Run's K_SERVICE
  return isGcp;
}

async function getIdTokenClient(audience: string): Promise<IdTokenClient> {
  let clientPromise = clientCache.get(audience);
  if (!clientPromise) {
    const auth = new GoogleAuth();
    clientPromise = auth.getIdTokenClient(audience);
    clientCache.set(audience, clientPromise);
  }
  return clientPromise;
}

/**
 * Returns Authorization headers for calling a protected Cloud Run service.
 * If the URL is localhost, no auth headers are returned (useful for local dev).
 */
export async function getCloudRunAuthHeaders(
  urlStr: string,
): Promise<Record<string, string>> {
  const url = new URL(urlStr);
  if (isLocalhost(url.hostname)) {
    return {};
  }

  const audience = audienceFromUrl(urlStr);

  try {
    // Get or create IdTokenClient for the given audience
    const client = await getIdTokenClient(audience);

    // getRequestHeaders uses the previously set audience and signs an ID token
    const headers = await client.getRequestHeaders(urlStr);
    // Normalize header keys to standard casing
    const authHeader = headers['Authorization'] ?? headers['authorization'];
    if (authHeader) {
      return { Authorization: String(authHeader) };
    } else {
      currentLogger.error(
        `[GCP-AUTH] ERROR: No Authorization header found in response: ${serialize(headers)}`,
      );
      return {};
    }
  } catch (error) {
    currentLogger.error(
      `[GCP-AUTH] ERROR getting auth headers for ${urlStr}: ${serialize(error)}`,
    );
    throw error;
  }
}

/**
 * Fetch implementation that injects Cloud Run ID token Authorization header automatically.
 * Pass this to HTTP client libraries (e.g., ts-rest initClient) that accept a custom fetch.
 */
export const authorizedFetch: typeof fetch = async (input, init) => {
  // Resolve URL string from the input variant
  const urlStr = (() => {
    if (typeof input === 'string') return input;
    // Support WHATWG URL as well as request-like objects
    try {
      if (input instanceof URL) return input.toString();
    } catch {
      // ignore if URL isn't available in this environment
    }
    // Try to access url property if it exists
    const maybeReq = input as { url?: unknown } | null;
    if (maybeReq && typeof maybeReq.url === 'string') return maybeReq.url;
    return String(input);
  })();

  // Only apply identity-based auth when running in GCP/Cloud Run
  const initOptions: FetchInit = init ? { ...init } : {};

  if (!isRunningInGcp()) {
    if (!hasLoggedLocalModeNotice) {
      currentLogger.log(`[GCP-AUTH] Not running in GCP, using standard fetch`);
      hasLoggedLocalModeNotice = true;
    }
    return fetch(input, initOptions);
  }

  try {
    const authHeaders = await getCloudRunAuthHeaders(urlStr);

    // Normalize and merge headers preserving originals (Headers, array, or record)
    // Convert incoming headers (string[][] | Record<string,string> | Headers | undefined) to Headers
    const toHeaders = (h?: FetchInit['headers']): Headers => {
      if (!h) return new Headers();
      if (h instanceof Headers) return new Headers(h);
      if (Array.isArray(h)) return new Headers(h);
      return new Headers(Object.entries(h as Record<string, string>));
    };

    const merged = toHeaders(initOptions.headers);
    // Apply auth header (overrides if already present)
    for (const [k, v] of Object.entries(authHeaders)) merged.set(k, v);

    const method = (initOptions.method ?? 'GET').toUpperCase();
    const expectsJsonBody = ['POST', 'PUT', 'PATCH'].includes(method);
    if (expectsJsonBody && !merged.has('content-type')) {
      merged.set('content-type', 'application/json');
    }

    // Defer to fetch with merged headers
    const response = await fetch(input, { ...initOptions, headers: merged });

    if (!response.ok) {
      currentLogger.error(
        `[GCP-AUTH] Request failed with status ${response.status}: ${response.statusText}`,
      );
    }

    return response;
  } catch (error) {
    currentLogger.error(
      `[GCP-AUTH] Error in authorizedFetch for ${urlStr}: ${serialize(error)}`,
    );
    throw error;
  }
};

/**
 * Utility to clear the internal auth client cache (useful for tests).
 */
export function __clearAuthClientCache(): void {
  clientCache.clear();
  hasLoggedLocalModeNotice = false;
}
