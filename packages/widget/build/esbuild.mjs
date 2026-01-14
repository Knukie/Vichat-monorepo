import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');
const distDir = path.join(rootDir, 'dist');

const entryFile = path.join(srcDir, 'index.js');
const sharedCssPath = path.join(srcDir, 'themes', 'shared.css');
const sharedCssModulePath = path.join(srcDir, 'themes', 'shared.js');
const widgetHostCssPath = path.join(srcDir, 'themes', 'widget-host.css');
const widgetHostCssModulePath = path.join(srcDir, 'themes', 'widget-host.js');
const templateHtmlPath = path.join(srcDir, 'core', 'ui', 'template.html');
const templateModulePath = path.join(srcDir, 'core', 'ui', 'template.js');

const isProd = process.env.NODE_ENV === 'production';
const sourcemap = !isProd;

await mkdir(distDir, { recursive: true });

const escapeBackticks = (str) => str.replace(/`/g, '\\`');

const templateSource = await readFile(templateHtmlPath, 'utf8');
await writeFile(
  templateModulePath,
  `// Generated from ${path.relative(rootDir, templateHtmlPath)}\nexport const templateHtml = \`${escapeBackticks(templateSource)}\`;\n`
);

const cssSource = await readFile(sharedCssPath, 'utf8').catch(() => '');
const widgetHostCssSource = await readFile(widgetHostCssPath, 'utf8').catch(() => '');
await writeFile(
  sharedCssModulePath,
  `// Generated from ${path.relative(rootDir, sharedCssPath)}\nexport const sharedCss = \`${escapeBackticks(cssSource)}\`;\n`
);
await writeFile(
  widgetHostCssModulePath,
  `// Generated from ${path.relative(rootDir, widgetHostCssPath)}\nexport const widgetHostCss = \`${escapeBackticks(widgetHostCssSource)}\`;\n`
);

const jsResult = await esbuild.build({
  entryPoints: [entryFile],
  bundle: true,
  format: 'iife',
  target: ['es2018'],
  minify: isProd,
  sourcemap,
  platform: 'browser',
  write: false
});

const jsOutput = jsResult.outputFiles?.find((f) => f.path.endsWith('.js'));
if (!jsOutput) {
  throw new Error('JS bundle not generated');
}
await writeFile(path.join(distDir, 'vichat-widget.min.js'), jsOutput.text);

const mergedCssSource = [widgetHostCssSource, cssSource].filter(Boolean).join('\n');
const cssResult = await esbuild.transform(mergedCssSource, { loader: 'css', minify: isProd });
await writeFile(path.join(distDir, 'vichat-widget.css'), cssResult.code || '');
