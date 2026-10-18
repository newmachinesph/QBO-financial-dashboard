import OAuthClient from 'intuit-oauth';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { qboConnection } from '@/db/schema';
import { encrypt, decrypt } from './crypto';

const ENV = process.env.QBO_ENV === 'production' ? 'production' : 'sandbox';
const API_BASE =
  ENV === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com';

export function oauthClient() {
  return new OAuthClient({
    clientId: process.env.QBO_CLIENT_ID!,
    clientSecret: process.env.QBO_CLIENT_SECRET!,
    environment: ENV,
    redirectUri: process.env.QBO_REDIRECT_URI!,
  });
}

// Persist a fresh token set (upsert on the single company row).
export async function saveToken(token: any) {
  const expiresAt = new Date(Date.now() + (token.expires_in ?? 3600) * 1000);
  const row = {
    realmId: String(token.realmId),
    refreshToken: encrypt(token.refresh_token),
    accessToken: token.access_token as string,
    expiresAt,
    updatedAt: new Date(),
  };
  await db
    .insert(qboConnection)
    .values(row)
    .onConflictDoUpdate({ target: qboConnection.realmId, set: row });
}

// Load the connection, refresh the access token if expired, return a ready client + realmId.
export async function getValidClient() {
  const [conn] = await db.select().from(qboConnection).limit(1);
  if (!conn) throw new Error('No QBO connection. Visit /api/qbo/connect first.');

  const client = oauthClient();
  const remaining = conn.expiresAt
    ? Math.floor((conn.expiresAt.getTime() - Date.now()) / 1000)
    : 0;
  client.setToken({
    token_type: 'bearer',
    access_token: conn.accessToken ?? '',
    refresh_token: decrypt(conn.refreshToken),
    realmId: conn.realmId,
    expires_in: remaining,
  });

  if (!client.isAccessTokenValid()) {
    const res = await client.refresh();
    await saveToken(res.getToken());
  }
  return { client, realmId: conn.realmId };
}

// Run a QBO query-language statement, return the entity array (empty if none).
// ponytail: re-loads/validates the token per call — fine for a daily batch. Thread the client
// through if you ever run this hot.
export async function qboQuery<T = any>(statement: string): Promise<T[]> {
  const { client, realmId } = await getValidClient();
  const token = client.getToken().access_token;
  const url = `${API_BASE}/v3/company/${realmId}/query?query=${encodeURIComponent(
    statement,
  )}&minorversion=73`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`QBO query failed ${res.status}: ${await res.text()}`);
  }
  const json = await res.json();
  const qr = json.QueryResponse ?? {};
  const entityKey = Object.keys(qr).find(
    (k) => !['startPosition', 'maxResults', 'totalCount'].includes(k),
  );
  return entityKey ? (qr[entityKey] as T[]) : [];
}
