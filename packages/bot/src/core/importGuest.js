import { normalizeImportImages } from "./images.js";
import { cleanText } from "./utils.js";

const MAX_ITEMS = 80;
const MAX_LEN = 1200;

export async function prepareGuestImportMessages(items = []) {
  const list = Array.isArray(items) ? items.slice(0, MAX_ITEMS) : [];
  const cleaned = [];

  for (const item of list) {
    const role = cleanText(item?.role) === "assistant" ? "assistant" : "user";
    const content = cleanText(item?.content).slice(0, MAX_LEN);
    const { images } = await normalizeImportImages(Array.isArray(item?.images) ? item.images : []);

    if (!content && images.length === 0) continue;
    cleaned.push({ role, content, images });
  }

  return cleaned;
}
