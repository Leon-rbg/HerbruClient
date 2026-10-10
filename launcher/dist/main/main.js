"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const auth_manager_1 = require("./auth-manager");
const install_manager_1 = require("./install-manager");
const mod_manager_1 = require("./mod-manager");
const version_catalog_1 = require("./version-catalog");
const manifestUrl = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';
const manifestCacheMs = 5 * 60 * 1000;
let cachedManifest;
async function getMinecraftVersions() {
    if (cachedManifest && cachedManifest.expiresAt > Date.now())
        return cachedManifest.value;
    const response = await fetch(manifestUrl, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok)
        throw new Error(`Mojang-Versionskatalog nicht erreichbar (HTTP ${response.status}).`);
    const body = await response.json();
    if (!(0, version_catalog_1.isMinecraftVersionManifest)(body))
        throw new Error('Mojang lieferte ein ungültiges Versionsmanifest.');
    cachedManifest = { expiresAt: Date.now() + manifestCacheMs, value: body };
    return body;
}
function createWindow() {
    const window = new electron_1.BrowserWindow({
        width: 1280,
        height: 820,
        minWidth: 960,
        minHeight: 640,
        show: false,
        backgroundColor: '#111412',
        webPreferences: {
            preload: (0, node_path_1.join)(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
        },
    });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', (event, url) => {
        if (!url.startsWith('file://'))
            event.preventDefault();
    });
    window.once('ready-to-show', () => window.show());
    void window.loadFile((0, node_path_1.join)(__dirname, '..', 'index.html'));
}
const modManager = new mod_manager_1.ModManager();
modManager.registerProvider({ id: 'modrinth', name: 'Modrinth', status: 'ready', endpoint: 'https://api.modrinth.com/v2' });
modManager.registerProvider({ id: 'curseforge', name: 'CurseForge', status: 'not-configured', endpoint: 'https://api.curseforge.com' });
electron_1.ipcMain.handle('minecraft:versions', getMinecraftVersions);
electron_1.ipcMain.handle('auth:build-url', (_event, config, state, nonce) => (0, auth_manager_1.buildMicrosoftAuthUrl)(config, state, nonce));
electron_1.ipcMain.handle('auth:exchange-code', async (_event, config, code) => (0, auth_manager_1.exchangeCodeForTokens)(config, code));
electron_1.ipcMain.handle('auth:refresh', async (_event, config, refreshToken) => (0, auth_manager_1.refreshTokens)(config, refreshToken));
electron_1.ipcMain.handle('auth:validate-xbox', async (_event, accessToken) => (0, auth_manager_1.validateXboxSession)(accessToken));
electron_1.ipcMain.handle('auth:validate-minecraft', async (_event, accessToken) => (0, auth_manager_1.validateMinecraftUser)(accessToken));
electron_1.ipcMain.handle('install:version', async (_event, target) => (0, install_manager_1.installVersion)({
    versionId: target?.versionId ?? '1.20.1',
    loader: target?.loader ?? 'fabric',
    loaderVersion: target?.loaderVersion ?? '0.16.14',
    path: target?.path ?? (0, node_path_1.join)(electron_1.app.getPath('userData'), 'HerbruClient'),
    memoryMb: Number(target?.memoryMb ?? 2048),
}));
electron_1.ipcMain.handle('launch:version', async (_event, target) => {
    const installTarget = {
        versionId: target?.versionId ?? '1.20.1',
        loader: target?.loader ?? 'fabric',
        loaderVersion: target?.loaderVersion ?? '0.16.14',
        path: target?.path ?? (0, node_path_1.join)(electron_1.app.getPath('userData'), 'HerbruClient'),
        memoryMb: Number(target?.memoryMb ?? 2048),
    };
    const result = await (0, install_manager_1.installVersion)(installTarget);
    const launchInfoPath = (0, node_path_1.join)(result.installDir, 'launch-info.json');
    await (0, promises_1.writeFile)(launchInfoPath, JSON.stringify({
        versionId: installTarget.versionId,
        loader: installTarget.loader,
        loaderVersion: installTarget.loaderVersion,
        launchedAt: new Date().toISOString(),
        mode: 'local-launch',
    }, null, 2), 'utf8');
    const openStatus = await electron_1.shell.openPath(result.installDir);
    if (openStatus) {
        throw new Error(`Der Installationsordner konnte nicht geöffnet werden: ${openStatus}`);
    }
    return { ...result, status: 'ready_to_launch', openedPath: result.installDir };
});
electron_1.ipcMain.handle('mods:providers', () => modManager.listProviders());
electron_1.ipcMain.handle('mods:search', (_event, query) => modManager.search(query));
electron_1.ipcMain.handle('mods:install', (_event, mod) => modManager.installMod(mod));
electron_1.ipcMain.handle('mods:remove', (_event, id) => modManager.removeMod(id));
const authManager = new auth_manager_1.AuthManager();
electron_1.app.whenReady().then(() => {
    createWindow();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
