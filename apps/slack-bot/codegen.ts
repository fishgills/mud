import { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  overwrite: true,
  // documents: 'src/**/*.graphql',
  // schema: '../**/schema.gql',
  ignoreNoDocuments: true,
  generates: {
    'apps/slack-bot/src/generated/dm-graphql.ts': {
      schema: 'dm-schema.gql',
      documents: 'apps/slack-bot/src/graphql/dm.graphql',
      plugins: [
        { add: { content: "import type { RequestInit } from 'node-fetch';" } },
        'typescript',
        'typescript-operations',
        'typescript-graphql-request',
        // 'typescript-generic-sdk',
      ],
    },
    'apps/slack-bot/src/generated/world-graphql.ts': {
      schema: 'world-schema.gql',
      documents: 'apps/slack-bot/src/graphql/world.graphql',
      plugins: [
        { add: { content: "import type { RequestInit } from 'node-fetch';" } },
        'typescript',
        'typescript-operations',
        'typescript-graphql-request',
        // 'typescript-generic-sdk',
      ],
    },
  },
};
export default config;
