import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { evaluateJavaRequirement, parseVersionId } from './instance-manager';

export interface VersionAsset {
  url: string;
  path: string;
  sha1?: string;
  size?: number;
}

export interface VersionMetadata {
  id: string;
  type: string;
  releaseTime: string;
  url: string;
  client?: { url: string; sha1?: string; size?: number };
  libraries: Array<{ name?: string; downloads?: { artifact?: { url?: string; sha1?: string; size?: number } } }>;
}

export interface InstallTarget {
  versionId: string;
  loader: string;
  loaderVersion: string;
  path: string;
  memoryMb: number;
}

export function validateSafePath(baseDir: string, targetPath: string): string {
  const normalizedBase = resolve(baseDir);
  const normalizedTarget = resolve(normalizedBase, targetPath);
  if (!normalizedTarget.startsWith(normalizedBase)) {
    throw new Error('Pfadverletzung erkannt: Ziel liegt außerhalb des Installationspfads.');
  }
  return normalizedTarget;
}

export function sanitizeEntryPath(entryPath: string): string {
  const sanitized = entryPath.replace(/^\/+/, '').replace(/\\/g, '/');
  if (sanitized.includes('..')) {
    throw new Error(`Unerlaubter Eintrag im Archiv: ${entryPath}`);
  }
  return sanitized;
}

export async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} bei ${url}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchAndVerifyFile(url: string, targetPath: string, expectedSha1?: string, expectedSize?: number): Promise<string> {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) {
    throw new Error(`Download fehlgeschlagen: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (expectedSize && buffer.length !== expectedSize) {
    throw new Error(`Dateigröße stimmt nicht: erwartet ${expectedSize}, erhalten ${buffer.length}.`);
  }

  if (expectedSha1) {
    const hash = require('node:crypto').createHash('sha1').update(buffer).digest('hex');
    if (hash !== expectedSha1.toLowerCase()) {
      throw new Error('Prüfsumme des Downloads stimmt nicht überein.');
    }
  }

  await mkdir(targetPath.substring(0, targetPath.lastIndexOf('/')), { recursive: true });
  await writeFile(targetPath, buffer);
  return targetPath;
}

export function buildVersionAssetList(metadata: VersionMetadata): VersionAsset[] {
  const assets: VersionAsset[] = [];
  if (metadata.client?.url) {
    assets.push({
      url: metadata.client.url,
      path: 'versions/' + metadata.id + '/' + metadata.id + '.jar',
      sha1: metadata.client.sha1,
      size: metadata.client.size,
    });
  }

  for (const library of metadata.libraries ?? []) {
    const artifact = library.downloads?.artifact;
    if (artifact?.url) {
      assets.push({
        url: artifact.url,
        path: sanitizeEntryPath(`libraries/${library.name ?? 'library'}`),
        sha1: artifact.sha1,
        size: artifact.size,
      });
    }
  }

  return assets;
}

export function resolveVersionMetadata(versionId: string): VersionMetadata {
  const parsed = parseVersionId(versionId);
  if (!parsed || (parsed.major === 1 && parsed.minor < 20)) {
    throw new Error('Diese Version wird nicht unterstützt: nur 1.20.0+ ist erlaubt.');
  }

  return {
    id: versionId,
    type: 'release',
    releaseTime: new Date().toISOString(),
    url: `https://piston-meta.mojang.com/mc/game/version_manifest_v2.json`,
    libraries: [],
  };
}

export async function installVersion(target: InstallTarget): Promise<{ installDir: string; metadataPath: string; status: string }> {
  const versionCheck = evaluateJavaRequirement(target.versionId);
  if (!versionCheck.compatible) {
    throw new Error(`Keine kompatible Java-Version für ${target.versionId}.`);
  }

  const installDir = validateSafePath(target.path, `instances/${target.versionId}_${target.loader}`);
  await mkdir(installDir, { recursive: true });

  const metadataPath = join(installDir, 'version.json');
  const manifest = resolveVersionMetadata(target.versionId);
  await writeFile(metadataPath, JSON.stringify({
    id: manifest.id,
    type: manifest.type,
    loader: target.loader,
    loaderVersion: target.loaderVersion,
    memoryMb: target.memoryMb,
    javaMajor: versionCheck.requiredJavaMajor,
    installedAt: new Date().toISOString(),
  }, null, 2), 'utf8');

  return {
    installDir,
    metadataPath,
    status: 'installed',
  };
}

export function ensureVersionMetadataFile(filePath: string, content: string): Promise<void> {
  return writeFile(filePath, content, 'utf8');
}

export async function validateManifestIntegrity(manifestPath: string): Promise<boolean> {
  try {
    const raw = await readFile(manifestPath, 'utf8');
    const parsed = JSON.parse(raw);
    return !!parsed && typeof parsed.id === 'string' && typeof parsed.loader === 'string';
  } catch {
    return false;
  }
}
