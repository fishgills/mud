export type HandlerContext = {
  userId: string;
  say: (msg: { text: string }) => Promise<void>;
  text: string;
};
