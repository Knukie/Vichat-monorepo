import type { ImageMeta } from "./image.js";

export type Role = "customer" | "assistant" | "agent" | "system" | "bot";

export type Message = {
  id: string;
  conversationId: string;
  role: Role;
  content: string;
  images: ImageMeta[];
  ts: string;
};
