import { GraphQLClient } from 'graphql-request';
import { authorizedFetch } from '@mud/gcp-auth';
import { env } from '../env';
import { getSdk, Sdk } from '../generated/world-graphql';

// Ensure the provided endpoint URL targets the GraphQL path. This guards against
// misconfigurations like missing /graphql and preserves existing base path (e.g., /world -> /world/graphql).
function ensureGraphQLEndpoint(urlStr: string): string {
  try {
    const u = new URL(urlStr);
    // If pathname already ends with /graphql, keep it; else append /graphql to existing path (handling trailing slash)
    if (!/\/graphql\/?$/.test(u.pathname)) {
      const basePath = u.pathname.replace(/\/$/, '');
      u.pathname = `${basePath}/graphql`;
    }
    return u.toString();
  } catch {
    // If URL parsing fails, just return the original string
    return urlStr;
  }
}

export const worldSdk: Sdk = getSdk(
  new GraphQLClient(ensureGraphQLEndpoint(env.WORLD_SERVICE_URL), {
    fetch: authorizedFetch,
  }),
);
