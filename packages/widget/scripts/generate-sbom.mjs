import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const packageJsonPath = path.join(repoRoot, 'package.json');
const lockfilePath = path.join(repoRoot, 'package-lock.json');
const outputPath = path.join(repoRoot, 'SBOM.json');

if (!fs.existsSync(lockfilePath)) {
  console.error('package-lock.json not found.');
  process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const lockfile = JSON.parse(fs.readFileSync(lockfilePath, 'utf8'));
const packages = lockfile.packages || {};

const components = [];
const seen = new Set();

const normalizeName = (pkgPath, entry) => {
  if (entry && entry.name) return entry.name;
  const parts = pkgPath.split('node_modules/').filter(Boolean);
  if (!parts.length) return null;
  return parts[parts.length - 1];
};

for (const [pkgPath, entry] of Object.entries(packages)) {
  if (!pkgPath || pkgPath === '') continue;
  const name = normalizeName(pkgPath, entry);
  const version = entry && entry.version;
  if (!name || !version) continue;
  const key = `${name}@${version}`;
  if (seen.has(key)) continue;
  seen.add(key);

  const component = {
    type: 'library',
    name,
    version
  };

  if (entry.license) {
    component.licenses = [
      {
        license: {
          id: String(entry.license)
        }
      }
    ];
  }

  components.push(component);
}

const sbom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.4',
  version: 1,
  metadata: {
    component: {
      type: 'application',
      name: packageJson.name || 'unknown',
      version: packageJson.version || '0.0.0'
    }
  },
  components: components.sort((a, b) => a.name.localeCompare(b.name))
};

fs.writeFileSync(outputPath, JSON.stringify(sbom, null, 2));
console.log(`SBOM written to ${outputPath}`);
