import { GraphQLClient } from 'graphql-request';
import { env } from './env';
import { getSdk as getDmSdk } from './generated/dm-graphql';

export const dmSdk: ReturnType<typeof getDmSdk> = getDmSdk(
  new GraphQLClient(env.DM_GQL_ENDPOINT),
);
