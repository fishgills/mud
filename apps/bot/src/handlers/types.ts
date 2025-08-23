export type SayMessage = {
  text?: string;
  blocks?: any[];
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
};
