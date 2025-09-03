import { GoogleAuth, IdTokenClient } from 'google-auth-library';
import fetch, { RequestInfo, RequestInit, Response } from 'node-fetch';

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
    console.log(`[GCP-AUTH] Localhost detected, skipping auth for: ${urlStr}`);
    return {};
  }

  const audience = audienceFromUrl(urlStr);
  console.log(`[GCP-AUTH] Using Cloud Run audience: ${audience}`);

  try {
    // Get or create IdTokenClient for the given audience
    const client = await getIdTokenClient(audience);
    console.log(
      `[GCP-AUTH] Successfully created IdTokenClient for audience: ${audience}`,
    );

    // getRequestHeaders uses the previously set audience and signs an ID token
    const headers = await client.getRequestHeaders(urlStr);
    console.log(`[GCP-AUTH] Obtained auth headers:`, Object.keys(headers));

    // Normalize header keys to standard casing
    const authHeader = headers['Authorization'] ?? headers['authorization'];
    if (authHeader) {
      console.log(
        `[GCP-AUTH] Successfully obtained Authorization header (length: ${String(authHeader).length})`,
      );
      return { Authorization: String(authHeader) };
    } else {
      console.error(
        `[GCP-AUTH] ERROR: No Authorization header found in response:`,
        headers,
      );
      return {};
    }
  } catch (error) {
    console.error(
      `[GCP-AUTH] ERROR getting auth headers for ${urlStr}:`,
      error,
    );
    throw error;
  }
}

/**
 * Fetch implementation that injects Cloud Run ID token Authorization header automatically.
 * Pass this to libraries (e.g., graphql-request) that accept a custom fetch.
 */
export async function authorizedFetch(
  input: RequestInfo,
  init?: RequestInit,
): Promise<Response> {
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
    if (input && typeof (input as any).url === 'string')
      return (input as any).url as string;
    return String(input);
  })();

  console.log(`[GCP-AUTH] authorizedFetch called for URL: ${urlStr}`);
  console.log(`[GCP-AUTH] isRunningInGcp(): ${isRunningInGcp()}`);

  // Only apply identity-based auth when running in GCP/Cloud Run
  if (!isRunningInGcp()) {
    console.log(`[GCP-AUTH] Not running in GCP, using standard fetch`);
    return fetch(input, init);
  }

  try {
    const authHeaders = await getCloudRunAuthHeaders(urlStr);

    // Properly merge headers for node-fetch compatibility
    const headers: Record<string, string> = {
      ...(init?.headers as Record<string, string> | undefined),
      ...authHeaders,
    };

    // Ensure GraphQL requests have the correct content type
    if (
      urlStr.includes('/graphql') &&
      !headers['content-type'] &&
      !headers['Content-Type']
    ) {
      headers['Content-Type'] = 'application/json';
      console.log(
        `[GCP-AUTH] Setting Content-Type to application/json for GraphQL request`,
      );
    }

    console.log(
      `[GCP-AUTH] Making authenticated request to ${urlStr} with headers:`,
      Object.keys(headers),
    );

    // Defer to node-fetch with merged headers
    const response = await fetch(input, { ...init, headers });

    console.log(
      `[GCP-AUTH] Response status: ${response.status} ${response.statusText}`,
    );

    if (!response.ok) {
      console.error(
        `[GCP-AUTH] Request failed with status ${response.status}: ${response.statusText}`,
      );
    }

    return response;
  } catch (error) {
    console.error(`[GCP-AUTH] Error in authorizedFetch for ${urlStr}:`, error);
    throw error;
  }
}

/**
 * Utility to clear the internal auth client cache (useful for tests).
 */
export function __clearAuthClientCache(): void {
  clientCache.clear();
}
