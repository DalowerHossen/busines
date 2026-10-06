// src/lib/storage/drive/client.ts
// Talking to the cloud drive of a business.
//
// The permission a business gives us is a long lived refresh token. It is
// exchanged for a short lived access token here, and the exchange is cached
// in memory for slightly less than its lifetime so a page that touches five
// files does not perform five exchanges.

import 'server-only';

import { serverEnv } from '@/env/server';
import { logger } from '@/lib/logger';

/** Where the drive service is reached. */
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

/** What this application asks a business for. */
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

export interface DriveCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  folderId: string;
}

interface CachedToken {
  accessToken: string;
  expiresAtMilliseconds: number;
}

const tokenCache = new Map<string, CachedToken>();

/**
 * Returns the client identity this application presents to the drive.
 *
 * @param stored Values already saved against the connection, if any.
 * @returns The identifier and secret, or null when neither is configured.
 */
export function driveClientIdentity(
  stored: Readonly<Record<string, string>> = {}
): { clientId: string; clientSecret: string } | null {
  const clientId = stored['client_id'] ?? serverEnv.GOOGLE_DRIVE_CLIENT_ID ?? '';
  const clientSecret = stored['client_secret'] ?? serverEnv.GOOGLE_DRIVE_CLIENT_SECRET ?? '';

  if (clientId === '' || clientSecret === '') {
    return null;
  }

  return { clientId, clientSecret };
}

/**
 * Exchanges the stored permission for a usable access token.
 *
 * @param credentials Permission of this connection.
 * @returns A token that can be sent to the drive.
 */
export async function driveAccessToken(credentials: DriveCredentials): Promise<string> {
  const cacheKey = `${credentials.clientId}:${credentials.refreshToken.slice(-12)}`;
  const cached = tokenCache.get(cacheKey);

  if (cached !== undefined && cached.expiresAtMilliseconds > Date.now()) {
    return cached.accessToken;
  }

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      refresh_token: credentials.refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    logger.error('The drive refused to renew its permission', null, {
      status: response.status,
    });

    throw new Error('The drive no longer accepts the permission this business gave it.');
  }

  const payload: unknown = await response.json();
  const accessToken =
    typeof payload === 'object' && payload !== null && 'access_token' in payload
      ? String((payload as { access_token: unknown }).access_token)
      : '';

  if (accessToken === '') {
    throw new Error('The drive returned no access token.');
  }

  tokenCache.set(cacheKey, {
    accessToken,
    expiresAtMilliseconds: Date.now() + 50 * 60 * 1000,
  });

  return accessToken;
}

/**
 * Exchanges a consent code for a long lived permission.
 *
 * @param code Code the drive sent back after the business agreed.
 * @param redirectUri Address the consent was sent back to.
 * @param identity Identity of this application.
 * @returns The refresh token, or null when the drive issued none.
 */
export async function exchangeDriveCode(
  code: string,
  redirectUri: string,
  identity: { clientId: string; clientSecret: string }
): Promise<string | null> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: identity.clientId,
      client_secret: identity.clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    logger.error('The drive refused the consent code', null, { status: response.status });

    return null;
  }

  const payload: unknown = await response.json();

  if (typeof payload !== 'object' || payload === null || !('refresh_token' in payload)) {
    return null;
  }

  const refreshToken = String((payload as { refresh_token: unknown }).refresh_token);

  return refreshToken === '' ? null : refreshToken;
}

/**
 * Creates the folder the documents of a business will live in.
 *
 * @param accessToken Token for the drive.
 * @param folderName Name the folder should carry.
 * @returns The identifier of the folder.
 */
export async function createDriveFolder(accessToken: string, folderName: string): Promise<string> {
  const response = await fetch(`${DRIVE_API}/files?fields=id`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });

  if (!response.ok) {
    throw new Error('A folder could not be created in that drive.');
  }

  const payload: unknown = await response.json();
  const id =
    typeof payload === 'object' && payload !== null && 'id' in payload
      ? String((payload as { id: unknown }).id)
      : '';

  if (id === '') {
    throw new Error('The drive created a folder but did not name it.');
  }

  return id;
}

/**
 * Opens a resumable upload the browser can send the bytes to.
 *
 * @param credentials Permission of this connection.
 * @param storageKey Key this application knows the file by.
 * @param fileName Name the file should carry in the drive.
 * @param mimeType Type of the file.
 * @returns The address the browser uploads to.
 */
export async function openDriveUpload(
  credentials: DriveCredentials,
  storageKey: string,
  fileName: string,
  mimeType: string
): Promise<string> {
  const accessToken = await driveAccessToken(credentials);

  const response = await fetch(`${DRIVE_UPLOAD_API}/files?uploadType=resumable&fields=id`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      'x-upload-content-type': mimeType,
    },
    body: JSON.stringify({
      name: fileName,
      parents: [credentials.folderId],
      appProperties: { storage_key: storageKey },
    }),
  });

  const location = response.headers.get('location');

  if (!response.ok || location === null) {
    throw new Error('The drive would not accept an upload right now.');
  }

  return location;
}

/**
 * Finds the identifier of a file the drive already holds.
 *
 * @param credentials Permission of this connection.
 * @param storageKey Key this application knows the file by.
 * @returns The identifier, or null when the drive has no such file.
 */
export async function findDriveFile(
  credentials: DriveCredentials,
  storageKey: string
): Promise<string | null> {
  const accessToken = await driveAccessToken(credentials);
  const query = `appProperties has { key='storage_key' and value='${storageKey}' } and trashed = false`;

  const response = await fetch(
    `${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id)&pageSize=1`,
    { headers: { authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    return null;
  }

  const payload: unknown = await response.json();

  if (typeof payload !== 'object' || payload === null || !('files' in payload)) {
    return null;
  }

  const files = (payload as { files: unknown }).files;

  if (!Array.isArray(files) || files.length === 0) {
    return null;
  }

  const first: unknown = files[0];

  return typeof first === 'object' && first !== null && 'id' in first
    ? String((first as { id: unknown }).id)
    : null;
}

/**
 * Reads the bytes of one file back out of the drive.
 *
 * @param credentials Permission of this connection.
 * @param externalId Identifier the drive gave the file.
 * @returns The response carrying the bytes.
 */
export async function fetchDriveObject(
  credentials: DriveCredentials,
  externalId: string
): Promise<Response> {
  const accessToken = await driveAccessToken(credentials);

  return fetch(`${DRIVE_API}/files/${externalId}?alt=media`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
}

/**
 * Moves one file in the drive to its wastebasket.
 *
 * @param credentials Permission of this connection.
 * @param externalId Identifier the drive gave the file.
 * @returns True when the drive accepted the change.
 */
export async function trashDriveObject(
  credentials: DriveCredentials,
  externalId: string
): Promise<boolean> {
  const accessToken = await driveAccessToken(credentials);

  const response = await fetch(`${DRIVE_API}/files/${externalId}`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ trashed: true }),
  });

  return response.ok;
}

/**
 * Asks the drive whether the permission still works.
 *
 * @param credentials Permission of this connection.
 * @returns A sentence about what the drive said.
 */
export async function checkDriveAccess(
  credentials: DriveCredentials
): Promise<{ isHealthy: boolean; message: string }> {
  try {
    const accessToken = await driveAccessToken(credentials);

    const response = await fetch(
      `${DRIVE_API}/files/${credentials.folderId}?fields=id,name,trashed`,
      { headers: { authorization: `Bearer ${accessToken}` } }
    );

    if (response.status === 404) {
      return {
        isHealthy: false,
        message: 'That folder is no longer in the drive. Connect it again.',
      };
    }

    if (!response.ok) {
      return { isHealthy: false, message: 'The drive refused this permission.' };
    }

    return { isHealthy: true, message: 'The drive answered and the folder is reachable.' };
  } catch {
    return { isHealthy: false, message: 'The drive could not be reached from this server.' };
  }
}
