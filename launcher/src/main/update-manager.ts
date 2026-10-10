export interface UpdateAsset {
  name: string;
  browser_download_url?: string;
  url?: string;
  [key: string]: unknown;
}

export interface ReleaseInfo {
  tag_name?: string;
  name?: string;
  assets?: UpdateAsset[];
  html_url?: string;
  prerelease?: boolean;
  draft?: boolean;
}

function normaliseVersion(value: string): number[] {
  const trimmed = value.trim();
  const match = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:[-+._][0-9A-Za-z.-]+)?$/.exec(trimmed);
  if (!match) return [];

  const parts = [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)];
  return parts;
}

export function isVersionNewer(currentVersion: string, candidateVersion: string): boolean {
  const current = normaliseVersion(currentVersion);
  const candidate = normaliseVersion(candidateVersion);
  if (current.length === 0 || candidate.length === 0) return false;

  const maxLength = Math.max(current.length, candidate.length);
  while (current.length < maxLength) current.push(0);
  while (candidate.length < maxLength) candidate.push(0);

  for (let index = 0; index < maxLength; index += 1) {
    if (candidate[index] > current[index]) return true;
    if (candidate[index] < current[index]) return false;
  }

  return false;
}

function comparePlatformNames(platform: string): string[] {
  const normalized = platform.toLowerCase();
  switch (normalized) {
    case 'win32':
      return ['.exe', '.msi', '.zip', '.7z'];
    case 'darwin':
      return ['.dmg', '.zip', '.tar.gz'];
    case 'linux':
      return ['.appimage', '.deb', '.tar.gz', '.zip'];
    default:
      return ['.exe', '.dmg', '.appimage', '.deb', '.tar.gz', '.zip'];
  }
}

function byNamePriority(name: string): number {
  const lower = name.toLowerCase();
  if (lower.includes('setup') || lower.includes('installer')) return 4;
  if (lower.includes('portable')) return 3;
  if (lower.includes('nsis')) return 2;
  return 1;
}

export function chooseUpdateAsset(assets: UpdateAsset[] | undefined, platform = process.platform): UpdateAsset | undefined {
  const safeAssets = Array.isArray(assets) ? assets.filter((asset) => typeof asset?.name === 'string') : [];
  if (safeAssets.length === 0) return undefined;

  const extensionPriority = comparePlatformNames(platform);

  const ranked = [...safeAssets].sort((left, right) => {
    const leftName = left.name.toLowerCase();
    const rightName = right.name.toLowerCase();

    const leftScore = extensionPriority.findIndex((suffix) => leftName.includes(suffix));
    const rightScore = extensionPriority.findIndex((suffix) => rightName.includes(suffix));
    const scoreDelta = (leftScore === -1 ? extensionPriority.length : leftScore) - (rightScore === -1 ? extensionPriority.length : rightScore);
    if (scoreDelta !== 0) return scoreDelta;

    const leftPriority = byNamePriority(left.name);
    const rightPriority = byNamePriority(right.name);
    if (leftPriority !== rightPriority) return rightPriority - leftPriority;

    return left.name.localeCompare(right.name);
  });

  return ranked[0];
}

export class UpdateManager {
  public isVersionNewer(currentVersion: string, candidateVersion: string): boolean {
    return isVersionNewer(currentVersion, candidateVersion);
  }

  public chooseAsset(assets: UpdateAsset[] | undefined, platform = process.platform): UpdateAsset | undefined {
    return chooseUpdateAsset(assets, platform);
  }

  public getLatestAssetForPlatform(release: ReleaseInfo | undefined, platform = process.platform): UpdateAsset | undefined {
    if (!release?.assets) return undefined;
    return chooseUpdateAsset(release.assets, platform);
  }
}
