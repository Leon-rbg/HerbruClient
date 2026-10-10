import { access, cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const releaseVersion = JSON.parse(await readFile(join(repoRoot, 'launcher/package.json'), 'utf8')).version;
const releaseName = `HeibruClient-v${releaseVersion}`;
const releaseDirectory = join(repoRoot, 'release', releaseName);
const jarsDirectory = join(releaseDirectory, 'client');
const releaseRoot = join(repoRoot, 'release');
const manifestUrl = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';
const yarnUrl = 'https://meta.fabricmc.net/v2/versions/yarn/';
const loaderUrl = 'https://meta.fabricmc.net/v2/versions/loader/';
const fabricApiMetadataUrl = 'https://maven.fabricmc.net/net/fabricmc/fabric-api/fabric-api/maven-metadata.xml';
const buildJavaVersion = '25';

function isAtLeast120(versionId) {
  const [major, minor] = versionId.split('.').map(Number);
  return major > 1 || (major === 1 && minor >= 20);
}

async function fetchJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} beim Abruf von ${url}`);
  return response.json();
}

async function getBuildVariants() {
  const [manifest, fabricApiResponse] = await Promise.all([
    fetchJson(manifestUrl),
    fetch(fabricApiMetadataUrl, { signal: AbortSignal.timeout(30_000) }),
  ]);
  if (!fabricApiResponse.ok) {
    throw new Error(`Fabric-API-Metadaten konnten nicht geladen werden (HTTP ${fabricApiResponse.status}).`);
  }

  const fabricApiXml = await fabricApiResponse.text();
  const fabricApiVersions = [...fabricApiXml.matchAll(/<version>([^<]+)<\/version>/g)].map((match) => match[1]);
  const versions = manifest.versions.filter((version) => {
    return version.type === 'release'
      && /^\d+\.\d+(?:\.\d+)?$/.test(version.id)
      && isAtLeast120(version.id);
  });

  const variants = [];
  for (const version of versions) {
    const [gameMetadata, loaders, yarnVersions] = await Promise.all([
      fetchJson(version.url),
      fetchJson(`${loaderUrl}${version.id}`),
      fetchJson(`${yarnUrl}${version.id}`),
    ]);
    const fabricApiVersion = fabricApiVersions.filter((candidate) => candidate.endsWith(`+${version.id}`)).at(-1);
    const loader = loaders.find((candidate) => candidate.loader?.stable);
    const yarn = yarnVersions[0]?.version;

    if (!fabricApiVersion) throw new Error(`Keine stabile Fabric-API-Version für Minecraft ${version.id} gefunden.`);
    if (!loader) throw new Error(`Kein stabiler Fabric Loader für Minecraft ${version.id} gefunden.`);
    if (!yarn && !version.id.startsWith('26.')) {
      throw new Error(`Für Minecraft ${version.id} fehlen Yarn-Mappings; der Build wird abgebrochen.`);
    }

    variants.push({
      id: version.id,
      javaMajor: gameMetadata.javaVersion?.majorVersion,
      mappingMode: yarn ? 'yarn' : 'none',
      yarnMappings: yarn ?? '',
      loaderVersion: loader.loader.version,
      fabricApiVersion,
    });
  }

  if (variants.length === 0) throw new Error('Keine stabilen Minecraft-Versionen ab 1.20 im Mojang-Manifest gefunden.');
  return variants;
}

async function buildVariant(variant) {
  if (!Number.isInteger(variant.javaMajor)) {
    throw new Error(`Minecraft ${variant.id} hat keine gültige Java-Anforderung im Mojang-Manifest.`);
  }

  const expectedJarName = `heibruclient-mc-${variant.id}-${releaseVersion}.jar`;
  const target = join(jarsDirectory, expectedJarName);
  let stagedJarExists = true;
  try {
    await access(target);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    stagedJarExists = false;
  }

  if (stagedJarExists) {
    const metadata = JSON.parse(execFileSync('unzip', ['-p', target, 'fabric.mod.json'], { encoding: 'utf8' }));
    if (metadata.id !== 'heibruclient'
        || metadata.version !== releaseVersion
        || metadata.depends?.minecraft !== variant.id
        || metadata.depends?.java !== `>=${variant.javaMajor}`) {
      throw new Error(`Die bereits vorhandene JAR für Minecraft ${variant.id} hat unpassende Mod-Metadaten.`);
    }

    const bytes = await readFile(target);
    console.log(`Minecraft ${variant.id}: validiertes JAR bereits vorhanden, Build wird übersprungen.`);
    return {
      minecraftVersion: variant.id,
      javaMajor: variant.javaMajor,
      fabricLoaderVersion: variant.loaderVersion,
      fabricApiVersion: variant.fabricApiVersion,
      file: `client/${expectedJarName}`,
      size: bytes.byteLength,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    };
  }

  console.log(`Building Minecraft ${variant.id} (Java ${variant.javaMajor}, Fabric API ${variant.fabricApiVersion})...`);
  execFileSync(join(repoRoot, 'gradlew'), [
    '--no-daemon',
    '--max-workers=1',
    '-Dorg.gradle.jvmargs=-Xmx1G',
    ':client:build',
    '--console=plain',
    `-Pminecraft_version=${variant.id}`,
    `-Pyarn_mappings=${variant.yarnMappings}`,
    `-Pmapping_mode=${variant.mappingMode}`,
    `-Ploader_version=${variant.loaderVersion}`,
    `-Pfabric_version=${variant.fabricApiVersion}`,
    `-Pjava_major_version=${variant.javaMajor}`,
    `-Pbuild_java_version=${buildJavaVersion}`,
    `-Pmod_version=${releaseVersion}`,
    `-Parchives_base_name=heibruclient-mc-${variant.id}`,
  ], { cwd: repoRoot, stdio: 'inherit' });

  const jars = (await readdir(join(repoRoot, 'client/build/libs'), { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name === expectedJarName);
  if (jars.length !== 1) {
    throw new Error(`Minecraft ${variant.id}: erwartete JAR-Datei ${expectedJarName} wurde nicht eindeutig erstellt.`);
  }
  const source = join(repoRoot, 'client/build/libs', expectedJarName);
  await cp(source, target);
  const bytes = await readFile(target);

  return {
    minecraftVersion: variant.id,
    javaMajor: variant.javaMajor,
    fabricLoaderVersion: variant.loaderVersion,
    fabricApiVersion: variant.fabricApiVersion,
    file: `client/${expectedJarName}`,
    size: bytes.byteLength,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

await mkdir(jarsDirectory, { recursive: true });
const variants = await getBuildVariants();
if (process.argv.includes('--list-only')) {
  console.log(JSON.stringify(variants, null, 2));
  process.exit(0);
}

if (process.env.GITHUB_REF_NAME && process.env.GITHUB_REF_NAME !== `v${releaseVersion}`) {
  throw new Error(`Tag ${process.env.GITHUB_REF_NAME} stimmt nicht mit Launcher-Version v${releaseVersion} überein.`);
}

const builtJars = [];

for (const variant of variants) {
  builtJars.push(await buildVariant(variant));
}

const manifest = {
  name: 'HeibruClient',
  version: releaseVersion,
  generatedAt: new Date().toISOString(),
  support: {
    game: 'Stable Minecraft releases from 1.20 up to the latest release in the official Mojang manifest at build time.',
    loader: 'Fabric',
    variants: builtJars.length,
  },
  files: builtJars,
};

await writeFile(join(releaseDirectory, 'client-variants.json'), JSON.stringify(manifest, null, 2));
await cp(join(repoRoot, 'RELEASE_NOTES.md'), join(releaseDirectory, 'RELEASE_NOTES.md'));
const archivePath = join(releaseRoot, `${releaseName}.zip`);
execFileSync('zip', ['-q', '-r', archivePath, releaseName], { cwd: releaseRoot, stdio: 'inherit' });
console.log(`Built ${builtJars.length} Minecraft-specific JARs in ${releaseDirectory}`);
console.log(`Release archive ready: ${archivePath}`);
