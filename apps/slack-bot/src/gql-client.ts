import { GraphQLClient } from 'graphql-request';
import { authorizedFetch } from '@mud/gcp-auth';
import { env } from './env';
import { getSdk as getDmSdk } from './generated/dm-graphql';
import { getSdk as getWorldSdk } from './generated/world-graphql';

// Ensure the provided endpoint URL targets the GraphQL path. This guards against
// misconfigurations like using http://localhost:3000/world instead of /graphql.
function ensureGraphQLEndpoint(urlStr: string): string {
  try {
    const u = new URL(urlStr);
    // If the path isn't exactly /graphql, force it to /graphql
    if (!/\/graphql\/?$/.test(u.pathname)) {
      u.pathname = '/graphql';
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
