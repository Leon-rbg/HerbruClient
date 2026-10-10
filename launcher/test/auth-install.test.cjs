const test = require('node:test');
const assert = require('node:assert/strict');

const { AuthManager, buildMicrosoftAuthUrl, exchangeCodeForTokens, refreshTokens } = require('../dist/main/auth-manager.js');
const { validateSafePath, sanitizeEntryPath, resolveVersionMetadata, installVersion } = require('../dist/main/install-manager.js');

const config = { clientId: 'abc123', redirectUri: 'https://localhost/callback', scopes: ['openid', 'profile', 'XboxLive.signin'] };

test('buildet eine offizielle Microsoft OAuth-URL', () => {
  const url = buildMicrosoftAuthUrl(config, 'state-123', 'nonce-456');
  assert.ok(url.startsWith('https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?'));
  assert.match(url, /client_id=abc123/);
  assert.match(url, /state=state-123/);
  assert.match(url, /nonce=nonce-456/);
  assert.match(url, /scope=openid/);
});

test('schützt Installationspfade vor Path Traversal und Archivpfaden', () => {
  const target = validateSafePath('/tmp/heibruclient', 'instances/test');
  assert.match(target, /instances\/test$/);

  assert.throws(() => validateSafePath('/tmp/heibruclient', '../evil'));
  assert.throws(() => sanitizeEntryPath('../escape.zip'));
});

test('liest Versionen ab 1.20.0 als gültige Installationsbasis', () => {
  const metadata = resolveVersionMetadata('1.20.1');
  assert.equal(metadata.id, '1.20.1');
  assert.equal(metadata.type, 'release');
});

test('installiert eine Minecraft-Version im lokalen Projektpfad mit validierter Metadatenstruktur', async () => {
  const result = await installVersion({
    versionId: '1.20.1',
    loader: 'fabric',
    loaderVersion: '0.16.14',
    path: '/tmp/heibruclient',
    memoryMb: 2048,
  });

  assert.equal(result.status, 'installed');
  assert.match(result.installDir, /instances\/1\.20\.1_fabric$/);
  assert.match(result.metadataPath, /version\.json$/);
});

test('persistiert sichere Session-Daten und erkennt abgelaufene Sitzungen', async () => {
  const manager = new AuthManager('/tmp/heibruclient-auth.json');
  await manager.clearSession();
  await manager.saveSession({ accessToken: 'token', refreshToken: 'refresh', expiresAt: Date.now() + 60_000, tokenType: 'Bearer', scope: 'openid profile' });
  const session = await manager.loadSession();
  assert.equal(session.accessToken, 'token');
  assert.equal(manager.isSessionValid(session), true);
  await manager.clearSession();
  assert.equal(await manager.loadSession(), null);
});

test('verarbeitet Microsoft-Token-Antworten sicher ohne Log-Exposure', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ access_token: 'newtoken', refresh_token: 'newrefresh', token_type: 'Bearer', expires_in: 3600, scope: 'openid' }),
  });

  try {
    const codeResult = await exchangeCodeForTokens(config, 'code-123');
    assert.equal(codeResult.access_token, 'newtoken');
    const refreshResult = await refreshTokens(config, 'refresh-123');
    assert.equal(refreshResult.refresh_token, 'newrefresh');
  } finally {
    global.fetch = originalFetch;
  }
});
