import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const loaderPath = path.join(__dirname, '..', 'public', 'valki-talki.js');

const contents = await fs.readFile(loaderPath, 'utf8');
const hasPlaceholders = /__MAIN__|__CSS__/.test(contents);

if (hasPlaceholders) {
  throw new Error(
    'public/valki-talki.js still contains __MAIN__ or __CSS__ placeholders. Build output is invalid.'
  );
}
