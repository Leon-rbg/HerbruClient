import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function createZipArchive(sourceDir, archivePath) {
  execSync(`cd "${sourceDir}" && zip -r "${archivePath}" .`, { stdio: 'inherit' });
}

const launcherDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(launcherDir, '..');
const releaseRoot = resolve(repoRoot, 'release');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const releaseTarget = resolve(releaseRoot, `HeibruClient-${timestamp}`);

async function copyDirectory(source, target) {
  await mkdir(target, { recursive: true });
  await cp(source, target, { recursive: true, force: true });
}

async function listJarFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.jar'))
    .map((entry) => entry.name);
}

async function prepareRelease() {
  await mkdir(releaseTarget, { recursive: true });
  await mkdir(join(releaseTarget, 'launcher'), { recursive: true });
  await mkdir(join(releaseTarget, 'client'), { recursive: true });

  console.log('Building client module...');
  execSync('cd "' + repoRoot + '" && ./gradlew :client:build --console=plain', { stdio: 'inherit' });

  console.log('Building launcher bundle...');
  execSync('cd "' + launcherDir + '" && npm run build', { stdio: 'inherit' });

  await copyDirectory(join(launcherDir, 'dist'), join(releaseTarget, 'launcher'));
  await cp(join(launcherDir, 'package.json'), join(releaseTarget, 'launcher-package.json'), { force: true });

  const clientLibsDir = join(repoRoot, 'client', 'build', 'libs');
  const jarFiles = await listJarFiles(clientLibsDir);
  if (jarFiles.length === 0) {
    throw new Error('Keine Client-JAR-Dateien im Ordner client/build/libs gefunden.');
  }

  for (const jarFile of jarFiles) {
    await cp(join(clientLibsDir, jarFile), join(releaseTarget, 'client', jarFile), { force: true });
  }

  const packageJson = JSON.parse(await readFile(join(launcherDir, 'package.json'), 'utf8'));
  const manifest = {
    name: 'HeibruClient',
    version: packageJson.version,
    buildTime: new Date().toISOString(),
    launcher: {
      source: 'launcher',
      entry: 'index.html',
      notes: 'Electron bundle for local launcher usage. Run with: npm install && npm start from launcher/',
    },
    client: {
      source: 'client',
      files: jarFiles,
      notes: 'Fabric client jar ready to be used with a local Minecraft installation.',
    },
    usage: [
      '1. Open the launcher bundle in release/HeibruClient-<timestamp>/launcher',
      '2. Install dependencies in launcher/ with npm install',
      '3. Start the launcher with npm start',
      '4. Use the copied client jar from release/HeibruClient-<timestamp>/client',
    ],
  };

  await writeFile(join(releaseTarget, 'manifest.json'), JSON.stringify(manifest, null, 2));

  const releaseArchive = join(releaseRoot, `HeibruClient-${timestamp}.zip`);
  createZipArchive(releaseTarget, releaseArchive);

  console.log(`Release prepared at ${releaseTarget}`);
  console.log(`Download archive ready: ${releaseArchive}`);
}

await prepareRelease();
