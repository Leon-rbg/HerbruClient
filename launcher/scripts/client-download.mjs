import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const launcherDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(launcherDir, '..');
const downloadDir = resolve(repoRoot, 'release', 'downloads', 'client');
const clientLibsDir = resolve(repoRoot, 'client', 'build', 'libs');

function createZipArchive(sourceDir, archivePath) {
  execSync(`cd "${sourceDir}" && zip -r "${archivePath}" .`, { stdio: 'inherit' });
}

async function listJarFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.jar'))
    .map((entry) => entry.name);
}

async function collectClientDownload() {
  await mkdir(downloadDir, { recursive: true });

  const jarFiles = await listJarFiles(clientLibsDir);
  if (jarFiles.length === 0) {
    throw new Error('Keine Client-JAR-Dateien gefunden. Baue zuerst den Client mit ./gradlew :client:build.');
  }

  const packagedFiles = [];
  for (const jarFile of jarFiles) {
    const sourcePath = join(clientLibsDir, jarFile);
    const targetPath = join(downloadDir, jarFile);
    await cp(sourcePath, targetPath, { force: true });
    const stats = await readFile(targetPath);
    packagedFiles.push({
      file: jarFile,
      size: stats.byteLength,
      path: `release/downloads/client/${jarFile}`,
    });
  }

  const manifest = {
    name: 'HerbruClient Client Download',
    generatedAt: new Date().toISOString(),
    files: packagedFiles,
    usage: 'Use the generated .jar file as the Fabric client artifact for a local Minecraft setup.',
    archive: 'herbruclient-client.zip',
  };

  const zipArchiveDir = resolve(repoRoot, 'release', 'downloads');
  const zipArchivePath = join(zipArchiveDir, 'herbruclient-client.zip');
  createZipArchive(downloadDir, zipArchivePath);

  await writeFile(join(downloadDir, 'client-download.json'), JSON.stringify(manifest, null, 2));
  console.log(`Client artifacts ready in ${downloadDir}`);
  console.log(`Client archive ready: ${zipArchivePath}`);
}

await collectClientDownload();
