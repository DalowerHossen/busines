import { createHmac, timingSafeEqual } from 'node:crypto';

export function headerValue(
  headers: Readonly<Record<string, string | undefined>>,
  name: string
): string | undefined {
  const wanted = name.toLowerCase();
  return Object.entries(headers).find(([key]) => key.toLowerCase() === wanted)?.[1];
}

export function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function hmacSha256Base64(secret: string, rawBody: string): string {
  return createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
}

export function hmacSha256Hex(secret: string, rawBody: string): string {
  return createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
}

export function verifyBase64Hmac(
  secret: string,
  rawBody: string,
  suppliedSignature: string | undefined
): boolean {
  return suppliedSignature
    ? constantTimeEqual(hmacSha256Base64(secret, rawBody), suppliedSignature)
    : false;
}

export function verifyHexHmac(
  secret: string,
  rawBody: string,
  suppliedSignature: string | undefined
): boolean {
  return suppliedSignature
    ? constantTimeEqual(hmacSha256Hex(secret, rawBody), suppliedSignature)
    : false;
}
