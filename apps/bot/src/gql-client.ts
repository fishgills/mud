import { GraphQLClient } from 'graphql-request';
import { env } from './env';
import { getSdk as getDmSdk } from './generated/dm-graphql';
import { getSdk as getWorldSdk } from './generated/world-graphql';

export const dmSdk = getDmSdk(new GraphQLClient(env.DM_GQL_ENDPOINT));
export const worldSdk = getWorldSdk(new GraphQLClient(env.WORLD_GQL_ENDPOINT));
