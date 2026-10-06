// src/lib/storage/signed-links.ts
import crypto from 'node:crypto';

export function makeApplicationSignedUrl(
  applicationUrl: string,
  signingSecret: string,
  companyId: string,
  providerFileId: string,
  expiresAt: number
): string {
  const payload = `${companyId}.${providerFileId}.${expiresAt}`;
  const signature = crypto.createHmac('sha256', signingSecret).update(payload).digest('base64url');
  const url = new URL(`${applicationUrl}/api/storage/files/${encodeURIComponent(providerFileId)}`);
  url.searchParams.set('company_id', companyId);
  url.searchParams.set('expires', String(expiresAt));
  url.searchParams.set('signature', signature);
  return url.toString();
}

export function verifyGoogleDriveApplicationSignature(input: {
  readonly signingSecret: string;
  readonly companyId: string;
  readonly providerFileId: string;
  readonly expiresAt: number;
  readonly signature: string;
  readonly nowInSeconds?: number;
}): boolean {
  if (!Number.isSafeInteger(input.expiresAt)) return false;
  if ((input.nowInSeconds ?? Math.floor(Date.now() / 1000)) >= input.expiresAt) return false;

  const payload = `${input.companyId}.${input.providerFileId}.${input.expiresAt}`;
  const expected = crypto
    .createHmac('sha256', input.signingSecret)
    .update(payload)
    .digest('base64url');
  const received = Buffer.from(input.signature);
  const expectedBuffer = Buffer.from(expected);

  return (
    received.length === expectedBuffer.length && crypto.timingSafeEqual(received, expectedBuffer)
  );
}
