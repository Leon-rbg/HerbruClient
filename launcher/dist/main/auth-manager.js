"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthManager = void 0;
exports.buildMicrosoftAuthUrl = buildMicrosoftAuthUrl;
exports.exchangeCodeForTokens = exchangeCodeForTokens;
exports.refreshTokens = refreshTokens;
exports.validateXboxSession = validateXboxSession;
exports.validateMinecraftUser = validateMinecraftUser;
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const node_os_1 = require("node:os");
function normalizeScopes(scopes) {
    return (scopes ?? ['XboxLive.signin', 'offline_access', 'openid', 'profile']).map((scope) => scope.trim()).filter(Boolean);
}
function buildMicrosoftAuthUrl(config, state, nonce) {
    const tenantId = config.tenantId ?? 'consumers';
    const params = new URLSearchParams({
        client_id: config.clientId,
        response_type: 'code',
        redirect_uri: config.redirectUri,
        response_mode: 'query',
        scope: normalizeScopes(config.scopes).join(' '),
        state,
        nonce,
        prompt: 'select_account',
    });
    return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
}
async function exchangeCodeForTokens(config, code) {
    const response = await fetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: config.clientId,
            scope: normalizeScopes(config.scopes).join(' '),
            code,
            redirect_uri: config.redirectUri,
            grant_type: 'authorization_code',
        }).toString(),
        signal: AbortSignal.timeout(15_000),
    });
    const payload = await response.json();
    if (!response.ok || payload.error) {
        throw new Error(payload.error_description ?? payload.error ?? 'Microsoft-Authentifizierung fehlgeschlagen.');
    }
    return payload;
}
async function refreshTokens(config, refreshToken) {
    const response = await fetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: config.clientId,
            scope: normalizeScopes(config.scopes).join(' '),
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
        }).toString(),
        signal: AbortSignal.timeout(15_000),
    });
    const payload = await response.json();
    if (!response.ok || payload.error) {
        throw new Error(payload.error_description ?? payload.error ?? 'Refresh-Token fehlgeschlagen.');
    }
    return payload;
}
async function validateXboxSession(accessToken) {
    const response = await fetch('https://user.auth.xboxlive.com/user/authenticate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
            Properties: {
                AuthMethod: 'RPS',
                SiteName: 'user.auth.xboxlive.com',
                RpsTicket: `d=${accessToken}`,
            },
            RelyingParty: 'http://auth.xboxlive.com',
            TokenType: 'JWT',
        }),
        signal: AbortSignal.timeout(15_000),
    });
    const payload = await response.json();
    if (!response.ok || !payload.Token || !payload.DisplayClaims?.xui?.[0]?.uhs) {
        throw new Error('Xbox-Session konnte nicht validiert werden.');
    }
    return {
        userHash: payload.DisplayClaims.xui[0].uhs,
        token: payload.Token,
    };
}
async function validateMinecraftUser(accessToken) {
    const response = await fetch('https://api.minecraftservices.com/minecraft/profile', {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
        },
        signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
        throw new Error('Minecraft-Berechtigung konnte nicht geprüft werden.');
    }
    const payload = await response.json();
    return { userId: payload.id, username: payload.name };
}
class AuthManager {
    storagePath;
    constructor(storageDir) {
        this.storagePath = storageDir ?? (0, node_path_1.join)(process.env.HERBRU_STORAGE_DIR ?? (0, node_os_1.tmpdir)(), 'herbruclient-auth.json');
    }
    async saveSession(session) {
        const payload = JSON.stringify(session, null, 2);
        const directory = this.storagePath.includes('/') ? this.storagePath.substring(0, this.storagePath.lastIndexOf('/')) : '.';
        await (0, promises_1.mkdir)(directory, { recursive: true });
        await (0, promises_1.writeFile)(this.storagePath, payload, 'utf8');
    }
    async loadSession() {
        try {
            const raw = await (0, promises_1.readFile)(this.storagePath, 'utf8');
            const parsed = JSON.parse(raw);
            if (!parsed?.accessToken || !parsed.expiresAt)
                return null;
            return parsed;
        }
        catch {
            return null;
        }
    }
    async clearSession() {
        try {
            await (0, promises_1.rm)(this.storagePath, { force: true });
        }
        catch {
            // no-op: sichere Entfernung ohne Log-Ausgabe
        }
    }
    isSessionValid(session) {
        return !!session && session.expiresAt > Date.now();
    }
}
exports.AuthManager = AuthManager;
