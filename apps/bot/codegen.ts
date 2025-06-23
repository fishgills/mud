import { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  overwrite: true,
  documents: 'src/**/*.graphql',
  schema: '../**/schema.gql',
  ignoreNoDocuments: true,
  generates: {
    'src/generated/dm-graphql.ts': {
      plugins: [
        { add: { content: "import type { RequestInit } from 'node-fetch';" } },
        'typescript',
        'typescript-operations',
        'typescript-graphql-request',
      ],
    },
  },
};
export default config;
