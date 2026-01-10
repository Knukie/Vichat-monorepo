import type { ImageMeta } from "./image.js";

export type Role = "assistant" | "customer" | "system" | "tool";

export type Message = {
  id: string;
  conversationId: string;
  role: Role;
  content: string;
  images: ImageMeta[];
  ts: string;
};
