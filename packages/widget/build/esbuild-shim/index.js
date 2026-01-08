import { readFile } from 'fs/promises';
import path from 'path';

const projectRoot = process.cwd();
const importStatementRegex = /import\s+([^'"]+?)\s+from\s+['"]([^'"]+)['"]\s*;?/g;
const importSideEffectRegex = /import\s*['"]([^'"]+)['"]\s*;?/g;

const normalizeModuleId = (filePath) =>
  path.relative(projectRoot, filePath).split(path.sep).join('/');

const resolveImportPath = (basePath, specifier) => {
  if (!specifier.startsWith('.')) {
    throw new Error(`Only relative imports are supported in esbuild shim: ${specifier}`);
  }
  const resolved = path.resolve(path.dirname(basePath), specifier);
  if (path.extname(resolved)) {
    return resolved;
  }
  return `${resolved}.js`;
};

const getImports = (code) => {
  const imports = [];
  for (const match of code.matchAll(importStatementRegex)) {
    imports.push({
      type: 'statement',
      clause: match[1],
      specifier: match[2]
    });
  }
  for (const match of code.matchAll(importSideEffectRegex)) {
    imports.push({
      type: 'side-effect',
      specifier: match[1]
    });
  }
  return imports;
};

const transformExports = (code) => {
  const exportedNames = [];
  const exportConstRegex = /export\s+const\s+([A-Za-z0-9_$]+)/g;
  const exportFunctionRegex = /export\s+(async\s+)?function\s+([A-Za-z0-9_$]+)/g;
  const exportClassRegex = /export\s+class\s+([A-Za-z0-9_$]+)/g;

  let transformed = code;

  transformed = transformed.replace(exportConstRegex, (_, name) => {
    exportedNames.push(name);
    return `const ${name}`;
  });

  transformed = transformed.replace(exportFunctionRegex, (_, asyncKeyword = '', name) => {
    exportedNames.push(name);
    const asyncPrefix = asyncKeyword ? `${asyncKeyword}` : '';
    return `${asyncPrefix}function ${name}`;
  });

  transformed = transformed.replace(exportClassRegex, (_, name) => {
    exportedNames.push(name);
    return `class ${name}`;
  });

  transformed = transformed.replace(/export\s+default\s+/g, 'exports.default = ');

  if (exportedNames.length) {
    transformed += `\n${exportedNames.map((name) => `exports.${name} = ${name};`).join('\n')}\n`;
  }

  return transformed;
};

const transformImports = (code, moduleIdMap) => {
  let transformed = code.replace(importStatementRegex, (match, clause, specifier) => {
    const resolvedId = moduleIdMap.get(specifier);
    if (!resolvedId) {
      return match;
    }
    const trimmedClause = clause.trim();
    if (trimmedClause.startsWith('{')) {
      return `const ${trimmedClause} = __require('${resolvedId}');`;
    }
    if (trimmedClause.startsWith('* as ')) {
      const name = trimmedClause.replace('* as ', '').trim();
      return `const ${name} = __require('${resolvedId}');`;
    }
    return `const ${trimmedClause} = __require('${resolvedId}').default;`;
  });

  transformed = transformed.replace(importSideEffectRegex, (match, specifier) => {
    const resolvedId = moduleIdMap.get(specifier);
    if (!resolvedId) {
      return match;
    }
    return `__require('${resolvedId}');`;
  });

  return transformed;
};

const createBundle = async (entryFile) => {
  const moduleMap = new Map();
  const modules = [];

  const addModule = async (filePath) => {
    const absolutePath = path.resolve(filePath);
    if (moduleMap.has(absolutePath)) {
      return moduleMap.get(absolutePath);
    }
    const moduleId = normalizeModuleId(absolutePath);
    moduleMap.set(absolutePath, moduleId);
    const source = await readFile(absolutePath, 'utf8');
    const imports = getImports(source);
    const moduleIdMap = new Map();
    for (const entry of imports) {
      if (!entry.specifier.startsWith('.')) {
        continue;
      }
      const resolvedPath = resolveImportPath(absolutePath, entry.specifier);
      const resolvedId = await addModule(resolvedPath);
      moduleIdMap.set(entry.specifier, resolvedId);
    }

    let transformed = transformImports(source, moduleIdMap);
    transformed = transformExports(transformed);
    modules.push({ id: moduleId, code: transformed });
    return moduleId;
  };

  const entryId = await addModule(entryFile);

  const moduleEntries = modules
    .map(
      (module) =>
        `'${module.id}': (module, exports, __require) => {\n${module.code}\n}`
    )
    .join(',\n');

  const bundle = `(function(){\nconst __modules = {\n${moduleEntries}\n};\nconst __cache = {};\nconst __require = (id) => {\n  if (__cache[id]) {\n    return __cache[id].exports;\n  }\n  const module = { exports: {} };\n  __cache[id] = module;\n  __modules[id](module, module.exports, __require);\n  return module.exports;\n};\n__require('${entryId}');\n})();\n`;

  return bundle;
};

const minifyCss = (css) => {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,])\s*/g, '$1')
    .trim();
};

export const build = async ({ entryPoints, sourcemap }) => {
  const entryFile = entryPoints?.[0];
  if (!entryFile) {
    throw new Error('Missing entryPoints in esbuild shim build()');
  }
  const bundle = await createBundle(entryFile);
  const outputFiles = [
    {
      path: `${entryFile}.js`,
      text: bundle
    }
  ];

  if (sourcemap) {
    outputFiles.push({
      path: `${entryFile}.js.map`,
      text: JSON.stringify({
        version: 3,
        sources: [],
        names: [],
        mappings: ''
      })
    });
  }

  return { outputFiles };
};

export const transform = async (source, { minify }) => {
  const code = minify ? minifyCss(source) : source;
  return { code };
};

export default {
  build,
  transform
};
