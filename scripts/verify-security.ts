import assert from 'node:assert/strict';
import { assessBotRequest } from '@/lib/security/bot-detection';
import { createContentSecurityPolicy } from '@/lib/security/headers';
import { assessHoneypot } from '@/lib/security/honeypot';
import { buildRateLimitKey } from '@/lib/security/rate-limit';
import type { SecurityRequestSnapshot } from '@/lib/security/types';

const publicBrowserRequest: SecurityRequestSnapshot = {
  pathname: '/',
  method: 'GET',
  headers: {
    'user-agent': 'Mozilla/5.0 Chrome/140.0.0.0',
    'accept-language': 'en-US',
    'sec-ch-ua': '"Chromium"',
    'sec-fetch-mode': 'navigate',
  },
};
const sensitiveAutomationRequest: SecurityRequestSnapshot = {
  pathname: '/login',
  method: 'POST',
  headers: { 'user-agent': 'Mozilla/5.0 HeadlessChrome/140.0.0.0' },
};
const aiCrawlerRequest: SecurityRequestSnapshot = {
  pathname: '/api/checkout',
  method: 'POST',
  headers: { 'user-agent': 'GPTBot/1.0' },
};

assert.equal(assessBotRequest(publicBrowserRequest).action, 'allow');
assert.equal(assessBotRequest(sensitiveAutomationRequest).action, 'challenge');
assert.equal(assessBotRequest(aiCrawlerRequest).action, 'block');
assert.equal(assessHoneypot({ website: 'https://spam.example' }).tripped, true);
assert.equal(
  assessHoneypot({ form_started_at: 9_500 }, { nowMs: 10_000, minimumFillTimeMs: 800 }).reason,
  'too-fast'
);
assert.equal(assessHoneypot({ form_started_at: 8_000 }, { nowMs: 10_000 }).tripped, false);

const firstKey = buildRateLimitKey({
  pathname: '/api/checkout',
  method: 'POST',
  ipAddress: '203.0.113.4',
  accountIdentifier: 'company-1',
  userAgent: 'Browser/1.0',
});
const secondKey = buildRateLimitKey({
  pathname: '/api/checkout',
  method: 'GET',
  ipAddress: '203.0.113.4',
  accountIdentifier: 'company-1',
  userAgent: 'Browser/1.0',
});
assert.notEqual(firstKey, secondKey);

const nonce = 'dGVzdC1ub25jZQ==';
const policy = createContentSecurityPolicy({ nonce });
assert.match(policy, /'nonce-dGVzdC1ub25jZQ=='/u);
assert.doesNotMatch(policy, /unsafe-eval/u);

process.stdout.write('Security protection smoke test passed.\n');
