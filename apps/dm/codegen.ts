import { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  overwrite: true,
  // documents: 'src/**/*.graphql',
  // schema: '../**/schema.gql',
  ignoreNoDocuments: true,
  generates: {
    'src/generated/world-graphql.ts': {
      schema: 'apps/world/src/schema.gql',
      documents: 'src/app/world/world.graphql',
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
