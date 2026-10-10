const test = require('node:test');
const assert = require('node:assert/strict');
const { ModManager } = require('../dist/main/mod-manager.js');

test('registriert Provider und verwaltet Mod-Installationen', () => {
  const manager = new ModManager();
  manager.registerProvider({ id: 'modrinth', name: 'Modrinth', status: 'ready' });
  manager.registerProvider({ id: 'curseforge', name: 'CurseForge', status: 'not-configured' });

  const installed = manager.installMod({
    id: 'mod-1',
    name: 'Sonnenlicht',
    provider: 'modrinth',
    version: '1.2.0',
    minecraftVersion: '1.20.1',
    loader: 'fabric',
    description: 'Beleuchtung und Status-Overlay',
  });

  assert.equal(installed.installationStatus, 'installed');
  assert.equal(manager.getProviderStatus('modrinth').status, 'ready');
  assert.equal(manager.search('sonnenlicht').length, 1);
  assert.equal(manager.listInstalledMods().length, 1);
  assert.equal(manager.removeMod('mod-1'), true);
  assert.equal(manager.listInstalledMods().length, 0);
});
