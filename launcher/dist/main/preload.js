"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('herbruClient', {
    getMinecraftVersions: () => electron_1.ipcRenderer.invoke('minecraft:versions'),
    buildMicrosoftAuthUrl: (config, state, nonce) => electron_1.ipcRenderer.invoke('auth:build-url', config, state, nonce),
    exchangeCodeForTokens: (config, code) => electron_1.ipcRenderer.invoke('auth:exchange-code', config, code),
    refreshTokens: (config, refreshToken) => electron_1.ipcRenderer.invoke('auth:refresh', config, refreshToken),
    validateMinecraftUser: (accessToken) => electron_1.ipcRenderer.invoke('auth:validate-minecraft', accessToken),
    installVersion: (target) => electron_1.ipcRenderer.invoke('install:version', target),
    launchVersion: (target) => electron_1.ipcRenderer.invoke('launch:version', target),
    listModProviders: () => electron_1.ipcRenderer.invoke('mods:providers'),
    searchMods: (query) => electron_1.ipcRenderer.invoke('mods:search', query),
    installMod: (mod) => electron_1.ipcRenderer.invoke('mods:install', mod),
    removeMod: (id) => electron_1.ipcRenderer.invoke('mods:remove', id),
});
