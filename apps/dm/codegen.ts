import { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  overwrite: true,
  // documents: 'src/**/*.graphql',
  // schema: '../**/schema.gql',
  ignoreNoDocuments: true,
  generates: {
    'apps/dm/src/generated/world-graphql.ts': {
      schema: 'world-schema.gql',
      documents: 'apps/dm/src/app/world/world.graphql',
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
