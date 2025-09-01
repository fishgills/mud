import { GoogleAuth, IdTokenClient } from 'google-auth-library';

// Cache IdTokenClient per audience to avoid re-creating on every call
const clientCache = new Map<string, Promise<IdTokenClient>>();

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
  // Prefer explicit flag set by our infra, fall back to Cloud Run's K_SERVICE
  return process.env.GCP_CLOUD_RUN === 'true' || !!process.env.K_SERVICE;
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
  const client = await getIdTokenClient(audience);
  // getRequestHeaders uses the previously set audience and signs an ID token
  const headers = await client.getRequestHeaders(urlStr);
  // Normalize header keys to standard casing
  const authHeader = headers['Authorization'] ?? headers['authorization'];
  return authHeader ? { Authorization: String(authHeader) } : {};
}

/**
 * Fetch implementation that injects Cloud Run ID token Authorization header automatically.
 * Pass this to libraries (e.g., graphql-request) that accept a custom fetch.
 */
export async function authorizedFetch(input: any, init?: any): Promise<any> {
  // Only apply identity-based auth when running in GCP/Cloud Run
  if (!isRunningInGcp()) {
    return (globalThis as any).fetch(input, init);
  }

  // Resolve URL string from the input variant
  const urlStr = (() => {
    if (typeof input === 'string') return input;
    // Support WHATWG URL as well as request-like objects
    try {
      if (input instanceof URL) return input.toString();
    } catch {
      // ignore if URL isn't available in this environment
    }
    if (input && typeof input.url === 'string') return input.url as string;
    return String(input);
  })();

  const authHeaders = await getCloudRunAuthHeaders(urlStr);
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
    ...authHeaders,
  };

  // Defer to global fetch (Node 18+ / undici), caller environment must provide it
  return (globalThis as any).fetch(input, { ...init, headers });
}

/**
 * Utility to clear the internal auth client cache (useful for tests).
 */
export function __clearAuthClientCache(): void {
  clientCache.clear();
}
