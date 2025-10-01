import { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  overwrite: true,
  ignoreNoDocuments: true,
  generates: {
    'apps/slack-bot/src/generated/dm-graphql.ts': {
      schema: 'dm-schema.gql',
      documents: 'apps/slack-bot/src/graphql/dm.graphql',
      plugins: ['typescript', 'typescript-operations'],
    },
    'apps/slack-bot/src/generated/world-graphql.ts': {
      schema: 'world-schema.gql',
      documents: 'apps/slack-bot/src/graphql/world.graphql',
      plugins: ['typescript', 'typescript-operations'],
    },
  },
};
export default config;
