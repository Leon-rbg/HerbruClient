import { contextBridge, ipcRenderer } from 'electron';
import type { MinecraftVersionManifest } from './version-catalog';

contextBridge.exposeInMainWorld('heibruClient', {
  getMinecraftVersions: (): Promise<MinecraftVersionManifest> => ipcRenderer.invoke('minecraft:versions'),
  buildMicrosoftAuthUrl: (config: { clientId: string; redirectUri: string; scopes?: string[]; tenantId?: string }, state: string, nonce: string): Promise<string> => ipcRenderer.invoke('auth:build-url', config, state, nonce),
  exchangeCodeForTokens: (config: { clientId: string; redirectUri: string; scopes?: string[]; tenantId?: string }, code: string): Promise<{ access_token: string; refresh_token?: string; token_type: string; expires_in: number; scope?: string }> => ipcRenderer.invoke('auth:exchange-code', config, code),
  refreshTokens: (config: { clientId: string; redirectUri: string; scopes?: string[]; tenantId?: string }, refreshToken: string): Promise<{ access_token: string; refresh_token?: string; token_type: string; expires_in: number; scope?: string }> => ipcRenderer.invoke('auth:refresh', config, refreshToken),
  validateMinecraftUser: (accessToken: string): Promise<{ userId?: string; username?: string }> => ipcRenderer.invoke('auth:validate-minecraft', accessToken),
  installVersion: (target: { versionId: string; loader: string; loaderVersion: string; path: string; memoryMb: number }): Promise<{ installDir: string; metadataPath: string; status: string }> => ipcRenderer.invoke('install:version', target),
  launchVersion: (target: { versionId: string; loader: string; loaderVersion: string; path: string; memoryMb: number }): Promise<{ installDir: string; metadataPath: string; status: string; openedPath: string }> => ipcRenderer.invoke('launch:version', target),
  listModProviders: (): Promise<Array<{ id: string; name: string; status: string; endpoint?: string }>> => ipcRenderer.invoke('mods:providers'),
  searchMods: (query: string): Promise<Array<{ id: string; name: string; provider: string; version: string; minecraftVersion: string; loader: string; description?: string; installationStatus: string }>> => ipcRenderer.invoke('mods:search', query),
  installMod: (mod: { id: string; name: string; provider: string; version: string; minecraftVersion: string; loader: string; description?: string }): Promise<{ id: string; name: string; installationStatus: string }> => ipcRenderer.invoke('mods:install', mod),
  removeMod: (id: string): Promise<boolean> => ipcRenderer.invoke('mods:remove', id),
});