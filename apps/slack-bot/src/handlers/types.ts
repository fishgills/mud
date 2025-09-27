import type { Block, KnownBlock } from '@slack/types';
import type { WebClient } from '@slack/web-api';

export type SayMessage = {
  text?: string;
  blocks?: (KnownBlock | Block)[];
  fileUpload?: {
    filename: string;
    contentBase64: string;
  };
};

export type HandlerContext = {
  userId: string;
  // Allow plain text, Block Kit, or request a file upload
  say: (msg: SayMessage) => Promise<void>;
  text: string;
  // Helper to resolve a Slack username or mention to a Slack user ID within this workspace
  resolveUserId?: (nameOrMention: string) => Promise<string | undefined>;
  client?: WebClient;
};
