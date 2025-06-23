import { GraphQLClient } from 'graphql-request';
import { env } from './env';
import { getSdk as getDmSdk } from './generated/dm-graphql';

import type { getSdk as getDmSdkType } from './generated/dm-graphql';

export const dmSdk: ReturnType<typeof getDmSdkType> = getDmSdk(
  new GraphQLClient(env.DM_GQL_ENDPOINT),
);
