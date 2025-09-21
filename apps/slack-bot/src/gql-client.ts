import { GraphQLClient } from 'graphql-request';
import { authorizedFetch } from '@mud/gcp-auth';
import { env } from './env';
import { getSdk as getDmSdk } from './generated/dm-graphql';
import { getSdk as getWorldSdk } from './generated/world-graphql';

// Ensure the provided endpoint URL targets the GraphQL path. This guards against
// misconfigurations like missing /graphql and preserves existing base path (e.g., /world -> /world/graphql).
function ensureGraphQLEndpoint(urlStr: string): string {
  try {
    const u = new URL(urlStr);
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

export const dmSdk = getDmSdk(
  new GraphQLClient(ensureGraphQLEndpoint(env.DM_GQL_ENDPOINT), {
    fetch: authorizedFetch,
  }),
);
export const worldSdk = getWorldSdk(
  new GraphQLClient(ensureGraphQLEndpoint(env.WORLD_GQL_ENDPOINT), {
    fetch: authorizedFetch,
  }),
);
