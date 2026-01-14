/* eslint-disable turbo/no-undeclared-env-vars */
process.env.SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN ?? 'test-slack-token';
process.env.SLACK_SIGNING_SECRET =
  process.env.SLACK_SIGNING_SECRET ?? 'test-signing-secret';
process.env.SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID ?? '';
process.env.SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET ?? '';
process.env.SLACK_STATE_SECRET = process.env.SLACK_STATE_SECRET ?? '';
