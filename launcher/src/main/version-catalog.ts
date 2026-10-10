export type MinecraftVersionType = 'release' | 'snapshot' | 'other';

export interface MinecraftVersion {
  id: string;
  type: string;
  url: string;
  time: string;
  releaseTime: string;
}

export interface MinecraftVersionManifest {
  latest: { release: string; snapshot: string };
  versions: MinecraftVersion[];
}

export function isMinecraftVersionManifest(value: unknown): value is MinecraftVersionManifest {
  if (typeof value !== 'object' || value === null) return false;
  const manifest = value as Partial<MinecraftVersionManifest>;
  return typeof manifest.latest?.release === 'string'
    && typeof manifest.latest?.snapshot === 'string'
    && Array.isArray(manifest.versions)
    && manifest.versions.every((version) =>
      typeof version.id === 'string'
      && typeof version.type === 'string'
      && typeof version.url === 'string'
      && typeof version.time === 'string'
      && typeof version.releaseTime === 'string');
}

function isSupportedCatalogEntry(version: MinecraftVersion): boolean {
  const match = /^(\d+)\.(\d+)(?:\.(\d+))?$/.exec(version.id);
  if (match) {
    const major = Number(match[1]);
    const minor = Number(match[2]);
    return major > 1 || (major === 1 && minor >= 20);
  }

  return Date.parse(version.releaseTime) >= Date.parse('2023-06-07T00:00:00Z');
}

export function selectMinecraftVersions(
  manifest: MinecraftVersionManifest,
  type: MinecraftVersionType | 'all' = 'all',
  query = '',
): MinecraftVersion[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return manifest.versions.filter((version) => {
    if (!isSupportedCatalogEntry(version)) return false;
    if (type !== 'all' && version.type !== type) return false;
    return version.id.toLocaleLowerCase().includes(normalizedQuery);
  });
}

export interface VersionSupportMatrix {
  supportedMinVersion: string;
  verifiedBuildTarget: string;
  supportedReleaseVersions: string[];
  supportedSnapshotVersions: string[];
  supportedCount: number;
}

export function getSupportMatrix(manifest: MinecraftVersionManifest): VersionSupportMatrix {
  const supported = selectMinecraftVersions(manifest, 'all', '');
  return {
    supportedMinVersion: '1.20.0',
    verifiedBuildTarget: '1.20.1',
    supportedReleaseVersions: supported.filter((version) => version.type === 'release').map((version) => version.id),
    supportedSnapshotVersions: supported.filter((version) => version.type === 'snapshot').map((version) => version.id),
    supportedCount: supported.length,
  };
}