import type { App } from '@slack/bolt';

let slackApp: App | null = null;

export const setSlackApp = (app: App) => {
  slackApp = app;
};

export const getSlackApp = (): App => {
  if (!slackApp) {
    throw new Error('Slack App instance has not been initialized yet.');
  }
  return slackApp;
};
