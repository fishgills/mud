// Deprecation shim: this package used to provide Cloud Run ID token helpers.
// The project now targets GKE only so these helpers are intentionally reduced
// to a tiny compatibility shim. Callers should use `fetch`/platform auth directly.

type FetchType = typeof fetch;

export function setAuthLogger(_: unknown): void {
  // no-op: logger not needed in GKE-only deployment
}

export function audienceFromUrl(urlStr: string): string {
  const u = new URL(urlStr);
  return `${u.protocol}//${u.host}`;
}

export function isRunningInGcp(): boolean {
  // We intentionally treat this as false for GKE-only deployments.
  return false;
}

export async function getCloudRunAuthHeaders(
  _urlStr: string,
): Promise<Record<string, string>> {
  // No-op shim: return empty headers
  return {};
}

export const authorizedFetch: FetchType = async (
  input: unknown,
  init?: any,
) => {
  // Defer to platform global fetch. Keep signature compatible.
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - forward to global fetch at runtime
  return (globalThis.fetch as FetchType)(input as any, init);
};

export function __clearAuthClientCache(): void {
  // no-op
}
