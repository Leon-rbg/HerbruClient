export type MinecraftVersionType = 'release' | 'snapshot' | 'other';

interface MinecraftVersion {
  id: string;
  type: string;
  url: string;
  time: string;
  releaseTime: string;
}

interface MinecraftVersionManifest {
  latest: { release: string; snapshot: string };
  versions: MinecraftVersion[];
}

function isSupportedVersion(version: MinecraftVersion): boolean {
  const numericId = /^(\d+)\.(\d+)(?:\.(\d+))?$/.exec(version.id);
  if (numericId) {
    return Number(numericId[1]) > 1 || (Number(numericId[1]) === 1 && Number(numericId[2]) >= 20);
  }
  return Date.parse(version.releaseTime) >= Date.parse('2023-06-07T00:00:00Z');
}

function selectMinecraftVersions(
  source: MinecraftVersionManifest,
  type: MinecraftVersionType | 'all',
  query: string,
): MinecraftVersion[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return source.versions.filter((version) => isSupportedVersion(version)
    && (type === 'all' || version.type === type)
    && version.id.toLocaleLowerCase().includes(normalizedQuery));
}

declare global {
  interface Window {
    herbruClient: {
      getMinecraftVersions(): Promise<MinecraftVersionManifest>;
      installVersion(target: { versionId: string; loader: string; loaderVersion: string; path: string; memoryMb: number }): Promise<{ installDir: string; metadataPath: string; status: string }>;
      launchVersion(target: { versionId: string; loader: string; loaderVersion: string; path: string; memoryMb: number }): Promise<{ installDir: string; metadataPath: string; status: string; openedPath: string }>;
      listModProviders(): Promise<Array<{ id: string; name: string; status: string; endpoint?: string }>>;
      searchMods(query: string): Promise<Array<{ id: string; name: string; provider: string; version: string; minecraftVersion: string; loader: string; description?: string; installationStatus: string }>>;
      installMod(mod: { id: string; name: string; provider: string; version: string; minecraftVersion: string; loader: string; description?: string }): Promise<{ id: string; name: string; installationStatus: string }>;
      removeMod(id: string): Promise<boolean>;
    };
  }
}

let manifest: MinecraftVersionManifest | undefined;
let selectedType: MinecraftVersionType | 'all' = 'all';

const versionList = document.querySelector<HTMLDivElement>('#version-list')!;
const versionSearch = document.querySelector<HTMLInputElement>('#version-search')!;
const catalogCount = document.querySelector<HTMLSpanElement>('#catalog-count')!;
const versionSelect = document.querySelector<HTMLSelectElement>('#home-version')!;
const supportMatrix = document.querySelector<HTMLDivElement>('#support-matrix')!;
const providerList = document.querySelector<HTMLDivElement>('#provider-list')!;
const modLibraryList = document.querySelector<HTMLDivElement>('#mod-library-list')!;
const installButton = document.querySelector<HTMLButtonElement>('#install-version-button')!;
const playButton = document.querySelector<HTMLButtonElement>('#play-button')!;
const installStatus = document.querySelector<HTMLParagraphElement>('#install-status')!;

function getLocalSupportMatrix(manifest: MinecraftVersionManifest): {
  supportedMinVersion: string;
  supportedReleaseVersions: string[];
  supportedSnapshotVersions: string[];
  supportedCount: number;
  modBuildStrategy: string;
} {
  const supported = selectMinecraftVersions(manifest, 'all', '');
  return {
    supportedMinVersion: '1.20.0',
    supportedReleaseVersions: supported.filter((version) => version.type === 'release').map((version) => version.id),
    supportedSnapshotVersions: supported.filter((version) => version.type === 'snapshot').map((version) => version.id),
    supportedCount: supported.length,
    modBuildStrategy: 'Minecraft-spezifische Fabric-JARs für stabile Releases',
  };
}

function renderVersion(version: MinecraftVersion): HTMLDivElement {
  const item = document.createElement('div');
  item.className = 'version-row';

  const identity = document.createElement('div');
  identity.className = 'version-identity';
  const name = document.createElement('strong');
  name.textContent = version.id;
  const badge = document.createElement('span');
  badge.className = `type-badge type-${version.type}`;
  badge.textContent = version.type === 'release' ? 'RELEASE' : version.type === 'snapshot' ? 'SNAPSHOT' : version.type.toUpperCase();
  identity.append(name, badge);

  const date = document.createElement('span');
  date.className = 'version-date';
  const parsedDate = new Date(version.releaseTime);
  date.textContent = Number.isNaN(parsedDate.valueOf()) ? 'Datum nicht verfügbar' : parsedDate.toLocaleDateString('de-DE');

  const state = document.createElement('span');
  state.className = 'version-state';
  state.textContent = 'Im Katalog';
  item.append(identity, date, state);
  return item;
}

function renderVersions(): void {
  if (!manifest) return;
  const versions = selectMinecraftVersions(manifest, selectedType, versionSearch.value);
  versionList.replaceChildren(...versions.map(renderVersion));
  catalogCount.textContent = `${versions.length} Version${versions.length === 1 ? '' : 'en'} angezeigt`;
}

function populateHomeVersions(): void {
  if (!manifest) return;
  const releases = selectMinecraftVersions(manifest, 'release', '');
  const options = releases.map((version) => {
    const option = document.createElement('option');
    option.value = version.id;
    option.textContent = version.id;
    return option;
  });
  versionSelect.replaceChildren(...options);
  if (manifest.latest.release && releases.some((version) => version.id === manifest?.latest.release)) {
    versionSelect.value = manifest.latest.release;
  }
}

function showError(message: string): void {
  versionList.replaceChildren();
  const error = document.createElement('div');
  error.className = 'error-state';
  error.textContent = message;
  versionList.append(error);
  catalogCount.textContent = 'Katalog nicht verfügbar';
  document.querySelector('#connection-status')!.textContent = 'Offline';
  document.querySelector('.status-dot')!.classList.add('offline');
}

function renderProviders(providers: Array<{ id: string; name: string; status: string; endpoint?: string }>): void {
  providerList.replaceChildren();
  for (const provider of providers) {
    const pill = document.createElement('div');
    pill.className = 'provider-pill';
    const dot = document.createElement('span');
    dot.className = `dot ${provider.status}`;
    const label = document.createElement('span');
    label.textContent = `${provider.name} · ${provider.status}`;
    pill.append(dot, label);
    providerList.append(pill);
  }
}

async function installSelectedVersion(): Promise<void> {
  const versionId = versionSelect.value;
  if (!versionId) {
    installStatus.textContent = 'Bitte wähle zuerst eine Version aus.';
    installStatus.classList.add('error');
    return;
  }

  installButton.disabled = true;
  playButton.disabled = true;
  installStatus.textContent = `Version ${versionId} wird installiert...`;
  installStatus.classList.remove('error');

  try {
    const result = await window.herbruClient.installVersion({
      versionId,
      loader: 'fabric',
      loaderVersion: '0.16.14',
      path: '.',
      memoryMb: 2048,
    });

    installStatus.textContent = `Installiert: ${result.status} · ${result.installDir}`;
    playButton.disabled = false;
  } catch (error) {
    installStatus.textContent = error instanceof Error ? error.message : 'Installation fehlgeschlagen.';
    installStatus.classList.add('error');
    playButton.disabled = true;
  } finally {
    installButton.disabled = false;
  }
}

async function launchSelectedVersion(): Promise<void> {
  const versionId = versionSelect.value;
  if (!versionId) {
    installStatus.textContent = 'Bitte wähle zuerst eine Version aus.';
    installStatus.classList.add('error');
    return;
  }

  playButton.disabled = true;
  installStatus.textContent = `Startvorbereitung für ${versionId}...`;
  installStatus.classList.remove('error');

  try {
    const result = await window.herbruClient.launchVersion({
      versionId,
      loader: 'fabric',
      loaderVersion: '0.16.14',
      path: '.',
      memoryMb: 2048,
    });

    installStatus.textContent = `Start bereit · Ordner geöffnet: ${result.openedPath}`;
  } catch (error) {
    installStatus.textContent = error instanceof Error ? error.message : 'Start fehlgeschlagen.';
    installStatus.classList.add('error');
  } finally {
    playButton.disabled = false;
  }
}

function renderModLibrary(mods: Array<{ id: string; name: string; provider: string; version: string; minecraftVersion: string; loader: string; description?: string; installationStatus: string }>): void {
  modLibraryList.replaceChildren();
  if (mods.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = '<span class="empty-mark">◈</span><h2>Keine installierten Mods</h2><p>Die Mod-Bibliothek zeigt die aktuellen installierten Einträge an.</p>';
    modLibraryList.append(empty);
    return;
  }

  for (const mod of mods) {
    const card = document.createElement('div');
    card.className = 'mod-card';
    const info = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = mod.name;
    const meta = document.createElement('div');
    meta.className = 'mod-meta';
    meta.innerHTML = `<span>${mod.provider}</span><span>v${mod.version}</span><span>${mod.minecraftVersion}</span><span>${mod.loader}</span>`;
    const description = document.createElement('div');
    description.className = 'mod-meta';
    description.textContent = mod.description ?? 'Keine Beschreibung verfügbar.';
    info.append(title, meta, description);
    const status = document.createElement('div');
    status.className = 'mod-status';
    status.textContent = mod.installationStatus;
    card.append(info, status);
    modLibraryList.append(card);
  }
}

document.querySelectorAll<HTMLButtonElement>('.nav-item').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelector('.nav-item.active')?.classList.remove('active');
    document.querySelector('.view.active')?.classList.remove('active');
    button.classList.add('active');
    document.querySelector(`#view-${button.dataset.view}`)?.classList.add('active');
    document.querySelector('#breadcrumb-current')!.textContent = button.textContent?.trim() ?? '';
  });
});

document.querySelectorAll<HTMLButtonElement>('.filter-button').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelector('.filter-button.active')?.classList.remove('active');
    button.classList.add('active');
    selectedType = button.dataset.filter as MinecraftVersionType | 'all';
    renderVersions();
  });
});

versionSearch.addEventListener('input', renderVersions);
installButton.addEventListener('click', () => void installSelectedVersion());
playButton.addEventListener('click', () => void launchSelectedVersion());

void window.herbruClient.getMinecraftVersions().then((result: MinecraftVersionManifest) => {
  manifest = result;
  document.querySelector('#connection-status')!.textContent = 'Verbunden';
  document.querySelector('#latest-release')!.textContent = `Aktuelles Release ${result.latest.release}`;
  const matrix = getLocalSupportMatrix(result);
  supportMatrix.textContent = `Katalog: ${matrix.supportedMinVersion}+ · ${matrix.modBuildStrategy} · ${matrix.supportedCount} Einträge`;
  populateHomeVersions();
  renderVersions();
  playButton.disabled = !versionSelect.value;
  installButton.disabled = !versionSelect.value;
  versionSelect.addEventListener('change', () => {
    playButton.disabled = !versionSelect.value;
    installButton.disabled = !versionSelect.value;
    installStatus.textContent = versionSelect.value ? `Version ausgewählt: ${versionSelect.value}` : 'Keine Installation gestartet. Bitte Version auswählen.';
    installStatus.classList.remove('error');
  });
  return Promise.all([
    window.herbruClient.listModProviders(),
    window.herbruClient.searchMods(''),
  ]);
}).then(([providers, mods]) => {
  renderProviders(providers);
  renderModLibrary(mods);
}).catch((error: unknown) => {
  showError(error instanceof Error ? error.message : 'Der Versionskatalog konnte nicht geladen werden.');
  versionSelect.replaceChildren(new Option('Katalog nicht verfügbar', ''));
});