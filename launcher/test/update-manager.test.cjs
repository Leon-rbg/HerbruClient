const test = require('node:test');
const assert = require('node:assert/strict');

const { isVersionNewer, chooseUpdateAsset } = require('../dist/main/update-manager.js');

test('compare versions for update checks', () => {
  assert.equal(isVersionNewer('0.1.0', '0.1.1'), true);
  assert.equal(isVersionNewer('0.1.1', '0.1.0'), false);
  assert.equal(isVersionNewer('0.1.0', '0.1.0'), false);
  assert.equal(isVersionNewer('1.2.3', '1.2.10'), true);
});

test('select a Windows installer asset for the current platform', () => {
  const assets = [
    { name: 'heibruclient-launcher-0.1.0-x64.nsis.7z', browser_download_url: 'https://example.test/7z' },
    { name: 'HeibruClient Setup 0.1.0.exe', browser_download_url: 'https://example.test/exe' },
  ];

  const chosen = chooseUpdateAsset(assets, 'win32');
  assert.equal(chosen?.name, 'HeibruClient Setup 0.1.0.exe');
});
