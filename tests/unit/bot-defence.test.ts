// tests/unit/bot-defence.test.ts
// Judging who is at the door. A signed client link is opened by a person
// with a browser; anything else reaching it has no business there.

import { describe, expect, it } from 'vitest';

import {
  isDataCrawler,
  isHoneypotTripped,
  judgePublicRequest,
  judgeSensitiveRequest,
} from '@/lib/security/bot-defence';

const CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

describe('a page that holds money or a private document', () => {
  it('lets an ordinary browser through', () => {
    expect(judgeSensitiveRequest(CHROME).isRefused).toBe(false);
  });

  it('turns away a request with no user agent at all', () => {
    expect(judgeSensitiveRequest(null).reason).toBe('no_user_agent');
  });

  it('turns away a model crawler that ignored the robots file', () => {
    expect(judgeSensitiveRequest('GPTBot/1.1').reason).toBe('known_crawler');
  });

  it('turns away a script pretending to be a client', () => {
    expect(judgeSensitiveRequest('python-requests/2.31.0').reason).toBe('automation_tool');
  });

  it('turns away a headless browser', () => {
    expect(judgeSensitiveRequest(`${CHROME} HeadlessChrome/124.0`).reason).toBe('automation_tool');
  });
});

describe('a public marketing page', () => {
  it('leaves a search engine alone, because being found is the point', () => {
    expect(judgePublicRequest('Mozilla/5.0 (compatible; Googlebot/2.1)').isRefused).toBe(false);
  });

  it('still turns away a crawler that collects training material', () => {
    expect(judgePublicRequest('CCBot/2.0').isRefused).toBe(true);
  });

  it('does not refuse a visitor merely for having an unusual browser', () => {
    expect(judgePublicRequest('Lynx/2.9.0').isRefused).toBe(false);
  });
});

describe('recognising a data crawler', () => {
  it('matches whatever case the agent uses', () => {
    expect(isDataCrawler('claudebot/1.0')).toBe(true);
    expect(isDataCrawler('ClaudeBot/1.0')).toBe(true);
  });

  it('does not match an ordinary browser', () => {
    expect(isDataCrawler(CHROME)).toBe(false);
  });
});

describe('the honeypot field', () => {
  it('is empty when a person filled the form in', () => {
    expect(isHoneypotTripped('')).toBe(false);
    expect(isHoneypotTripped(undefined)).toBe(false);
  });

  it('is filled when a script filled everything in', () => {
    expect(isHoneypotTripped('+1 555 0100')).toBe(true);
  });
});
