import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AuthManager, buildMicrosoftAuthUrl, exchangeCodeForTokens, refreshTokens, validateMinecraftUser, validateXboxSession } from './auth-manager';
import { installVersion } from './install-manager';
import { ModManager } from './mod-manager';
import { isMinecraftVersionManifest, type MinecraftVersionManifest } from './version-catalog';

const manifestUrl = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';
const manifestCacheMs = 5 * 60 * 1000;
let cachedManifest: { expiresAt: number; value: MinecraftVersionManifest } | undefined;

async function getMinecraftVersions(): Promise<MinecraftVersionManifest> {
  if (cachedManifest && cachedManifest.expiresAt > Date.now()) return cachedManifest.value;

  const response = await fetch(manifestUrl, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Mojang-Versionskatalog nicht erreichbar (HTTP ${response.status}).`);

  const body: unknown = await response.json();
  if (!isMinecraftVersionManifest(body)) throw new Error('Mojang lieferte ein ungültiges Versionsmanifest.');

  cachedManifest = { expiresAt: Date.now() + manifestCacheMs, value: body };
  return body;
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: '#111412',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) event.preventDefault();
  });
  window.once('ready-to-show', () => window.show());
  void window.loadFile(join(__dirname, '..', 'index.html'));
}

const modManager = new ModManager();
modManager.registerProvider({ id: 'modrinth', name: 'Modrinth', status: 'ready', endpoint: 'https://api.modrinth.com/v2' });
modManager.registerProvider({ id: 'curseforge', name: 'CurseForge', status: 'not-configured', endpoint: 'https://api.curseforge.com' });

ipcMain.handle('minecraft:versions', getMinecraftVersions);
ipcMain.handle('auth:build-url', (_event, config, state, nonce) => buildMicrosoftAuthUrl(config, state, nonce));
ipcMain.handle('auth:exchange-code', async (_event, config, code) => exchangeCodeForTokens(config, code));
ipcMain.handle('auth:refresh', async (_event, config, refreshToken) => refreshTokens(config, refreshToken));
ipcMain.handle('auth:validate-xbox', async (_event, accessToken) => validateXboxSession(accessToken));
ipcMain.handle('auth:validate-minecraft', async (_event, accessToken) => validateMinecraftUser(accessToken));
ipcMain.handle('install:version', async (_event, target) => installVersion({
  versionId: target?.versionId ?? '1.20.1',
  loader: target?.loader ?? 'fabric',
  loaderVersion: target?.loaderVersion ?? '0.16.14',
  path: target?.path ?? join(app.getPath('userData'), 'HeibruClient'),
  memoryMb: Number(target?.memoryMb ?? 2048),
}));
ipcMain.handle('launch:version', async (_event, target) => {
  const installTarget = {
    versionId: target?.versionId ?? '1.20.1',
    loader: target?.loader ?? 'fabric',
    loaderVersion: target?.loaderVersion ?? '0.16.14',
    path: target?.path ?? join(app.getPath('userData'), 'HeibruClient'),
    memoryMb: Number(target?.memoryMb ?? 2048),
  };

  const result = await installVersion(installTarget);
  const launchInfoPath = join(result.installDir, 'launch-info.json');
  await writeFile(launchInfoPath, JSON.stringify({
    versionId: installTarget.versionId,
    loader: installTarget.loader,
    loaderVersion: installTarget.loaderVersion,
    launchedAt: new Date().toISOString(),
    mode: 'local-launch',
  }, null, 2), 'utf8');

  const openStatus = await shell.openPath(result.installDir);
  if (openStatus) {
    throw new Error(`Der Installationsordner konnte nicht geöffnet werden: ${openStatus}`);
  }

  return { ...result, status: 'ready_to_launch', openedPath: result.installDir };
});
ipcMain.handle('mods:providers', () => modManager.listProviders());
ipcMain.handle('mods:search', (_event, query) => modManager.search(query));
ipcMain.handle('mods:install', (_event, mod) => modManager.installMod(mod));
ipcMain.handle('mods:remove', (_event, id) => modManager.removeMod(id));

const authManager = new AuthManager();
app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});