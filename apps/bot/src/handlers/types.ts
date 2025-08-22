export type HandlerContext = {
  userId: string;
  // Allow plain text or Slack Block Kit messages
  say: (msg: { text?: string; blocks?: any[] }) => Promise<void>;
  text: string;
};
