import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export interface MicrosoftOAuthConfig {
  clientId: string;
  redirectUri: string;
  scopes?: string[];
  tenantId?: string;
}

export interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

export interface ManagedSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  tokenType: string;
  scope: string;
  userId?: string;
  username?: string;
}

function normalizeScopes(scopes: string[] | undefined): string[] {
  return (scopes ?? ['XboxLive.signin', 'offline_access', 'openid', 'profile']).map((scope) => scope.trim()).filter(Boolean);
}

export function buildMicrosoftAuthUrl(config: MicrosoftOAuthConfig, state: string, nonce: string): string {
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

export async function exchangeCodeForTokens(config: MicrosoftOAuthConfig, code: string): Promise<OAuthTokenResponse> {
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

  const payload = await response.json() as OAuthTokenResponse;
  if (!response.ok || payload.error) {
    throw new Error(payload.error_description ?? payload.error ?? 'Microsoft-Authentifizierung fehlgeschlagen.');
  }

  return payload;
}

export async function refreshTokens(config: MicrosoftOAuthConfig, refreshToken: string): Promise<OAuthTokenResponse> {
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

  const payload = await response.json() as OAuthTokenResponse;
  if (!response.ok || payload.error) {
    throw new Error(payload.error_description ?? payload.error ?? 'Refresh-Token fehlgeschlagen.');
  }

  return payload;
}

export async function validateXboxSession(accessToken: string): Promise<{ userHash: string; token: string }> {
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

  const payload = await response.json() as { Token?: string; DisplayClaims?: { xui?: Array<{ uhs?: string }> } };
  if (!response.ok || !payload.Token || !payload.DisplayClaims?.xui?.[0]?.uhs) {
    throw new Error('Xbox-Session konnte nicht validiert werden.');
  }

  return {
    userHash: payload.DisplayClaims.xui[0].uhs,
    token: payload.Token,
  };
}

export async function validateMinecraftUser(accessToken: string): Promise<{ username?: string; userId?: string }> {
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

  const payload = await response.json() as { id?: string; name?: string };
  return { userId: payload.id, username: payload.name };
}

export class AuthManager {
  private readonly storagePath: string;

  public constructor(storageDir?: string) {
    this.storagePath = storageDir ?? join(process.env.HERBRU_STORAGE_DIR ?? tmpdir(), 'herbruclient-auth.json');
  }

  public async saveSession(session: ManagedSession): Promise<void> {
    const payload = JSON.stringify(session, null, 2);
    const directory = this.storagePath.includes('/') ? this.storagePath.substring(0, this.storagePath.lastIndexOf('/')) : '.';
    await mkdir(directory, { recursive: true });
    await writeFile(this.storagePath, payload, 'utf8');
  }

  public async loadSession(): Promise<ManagedSession | null> {
    try {
      const raw = await readFile(this.storagePath, 'utf8');
      const parsed = JSON.parse(raw) as ManagedSession;
      if (!parsed?.accessToken || !parsed.expiresAt) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  public async clearSession(): Promise<void> {
    try {
      await rm(this.storagePath, { force: true });
    } catch {
      // no-op: sichere Entfernung ohne Log-Ausgabe
    }
  }

  public isSessionValid(session: ManagedSession | null): boolean {
    return !!session && session.expiresAt > Date.now();
  }
}
