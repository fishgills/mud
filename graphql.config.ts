import dotenv from 'dotenv';
dotenv.config();

// .graphqlrc.ts or graphql.config.ts
export default {
  projects: {
    bot: {
      schema: ['world-schema.gql', 'dm-schema.gql'],
      documents: ['apps/slack-bot/src/graphql/*.graphql'],
      extensions: {
        endpoints: {
          default: {
            url: 'https://localhost:3000/graphql/',
          },
        },
      },
    },
    dm: {
      schema: ['world-schema.gql'],
      documents: ['apps/dm/**/*.graphql'],
      extensions: {
        endpoints: {
          default: {
            url: 'https://localhost:3000/graphql/',
          },
        },
      },
    },
  },
};
