export interface ImageMeta {
  url: string;
  type: "user-upload" | "assistant-generated" | "external";
  name?: string;
  size?: number;
  host?: string;
  dataUrl?: string;
}
