import assert from 'node:assert/strict';
import {
  hmacSha256Base64,
  hmacSha256Hex,
  verifyBase64Hmac,
  verifyHexHmac,
} from '@/lib/ecommerce/signing';

const rawBody = '{"id":42,"status":"paid"}';
const secret = 'phase-30-test-secret';
const base64Signature = hmacSha256Base64(secret, rawBody);
const hexSignature = hmacSha256Hex(secret, rawBody);

assert.equal(base64Signature, 'OxpMi1b8508Jzc/LzMJdSEkQRAcaID6kP7V/IoGQL9I=');
assert.equal(hexSignature, '3b1a4c8b56fce74f09cdcfcbccc25d48491044071a203ea43fb57f2281902fd2');
assert.equal(verifyBase64Hmac(secret, rawBody, base64Signature), true);
assert.equal(verifyBase64Hmac(secret, `${rawBody} `, base64Signature), false);
assert.equal(verifyHexHmac(secret, rawBody, hexSignature), true);
assert.equal(verifyHexHmac(secret, rawBody, `${hexSignature}0`), false);

process.stdout.write('Ecommerce webhook signature smoke test passed.\n');
