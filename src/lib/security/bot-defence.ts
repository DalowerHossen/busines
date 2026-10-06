// src/lib/security/bot-defence.ts
// Keeping machines away from the pages that hold money and documents.
//
// Three different things are called bots and only two of them matter here.
// Search engines are welcome on the marketing pages and banned everywhere
// else. Model and dataset crawlers are banned outright, because nothing on
// this platform is training material and a client invoice least of all.
// Automation tools pointed at a signed client link are an attack and are
// refused before a single row is read.
//
// The module holds no secret and touches nothing, so it can also run inside
// the middleware, which is where most of these requests are turned away.

/** Crawlers that collect text for models or datasets. None are welcome. */
export const DATA_CRAWLER_AGENTS: readonly string[] = [
  'GPTBot',
  'ChatGPT-User',
  'OAI-SearchBot',
  'ClaudeBot',
  'Claude-Web',
  'anthropic-ai',
  'Google-Extended',
  'Applebot-Extended',
  'Meta-ExternalAgent',
  'Meta-ExternalFetcher',
  'FacebookBot',
  'CCBot',
  'PerplexityBot',
  'Perplexity-User',
  'YouBot',
  'Bytespider',
  'Amazonbot',
  'Diffbot',
  'Omgilibot',
  'Omgili',
  'ImagesiftBot',
  'cohere-ai',
  'Timpibot',
  'Webzio-Extended',
  'Scrapy',
  'AI2Bot',
  'DuckAssistBot',
  'PanguBot',
  'Kangaroo Bot',
  'Firecrawl',
];

/** Tools used to drive a browser or pull pages in bulk. */
const AUTOMATION_AGENTS: readonly string[] = [
  'headlesschrome',
  'phantomjs',
  'puppeteer',
  'playwright',
  'selenium',
  'webdriver',
  'python-requests',
  'python-urllib',
  'aiohttp',
  'httpx',
  'go-http-client',
  'java/',
  'okhttp',
  'curl/',
  'wget/',
  'libwww-perl',
  'httrack',
  'wpbot',
  'zgrab',
  'masscan',
  'nikto',
  'sqlmap',
  'nmap',
];

/** Why a request was refused. Matches the reasons the database accepts. */
export type BotVerdictReason =
  | 'known_crawler'
  | 'no_user_agent'
  | 'automation_tool'
  | 'rate_limited'
  | 'honeypot'
  | 'bad_origin';

export interface BotVerdict {
  /** True when the request should be refused. */
  isRefused: boolean;
  /** Why it was refused, when it was. */
  reason: BotVerdictReason | null;
}

const ALLOWED: BotVerdict = { isRefused: false, reason: null };

/**
 * Reports whether a user agent belongs to a model or dataset crawler.
 *
 * @param userAgent The user agent of the request.
 * @returns True when it is one of them.
 */
export function isDataCrawler(userAgent: string): boolean {
  const lowered = userAgent.toLowerCase();

  return DATA_CRAWLER_AGENTS.some((agent) => lowered.includes(agent.toLowerCase()));
}

/**
 * Judges one request to a page that holds money or a private document.
 *
 * A signed client link is opened by a person using a browser. Anything else
 * reaching it is either a crawler that ignored the robots file or a script,
 * and neither has any business there.
 *
 * @param userAgent The user agent of the request, if it sent one.
 * @returns Whether to refuse the request, and why.
 */
export function judgeSensitiveRequest(userAgent: string | null): BotVerdict {
  const agent = (userAgent ?? '').trim();

  if (agent === '' || agent.length < 10) {
    return { isRefused: true, reason: 'no_user_agent' };
  }

  if (isDataCrawler(agent)) {
    return { isRefused: true, reason: 'known_crawler' };
  }

  const lowered = agent.toLowerCase();

  if (AUTOMATION_AGENTS.some((tool) => lowered.includes(tool))) {
    return { isRefused: true, reason: 'automation_tool' };
  }

  return ALLOWED;
}

/**
 * Judges a request to a public marketing page.
 *
 * Search engines are left alone here because being found is the point. Only
 * the crawlers that take content for training are turned away.
 *
 * @param userAgent The user agent of the request, if it sent one.
 * @returns Whether to refuse the request, and why.
 */
export function judgePublicRequest(userAgent: string | null): BotVerdict {
  const agent = (userAgent ?? '').trim();

  if (agent !== '' && isDataCrawler(agent)) {
    return { isRefused: true, reason: 'known_crawler' };
  }

  return ALLOWED;
}

/** The field a form carries to catch a script that fills everything in. */
export const HONEYPOT_FIELD_NAME = 'company_fax_number';

/**
 * Reports whether a submitted form was filled in by a script.
 *
 * @param value What arrived in the honeypot field.
 * @returns True when a human would have left it empty and did not.
 */
export function isHoneypotTripped(value: unknown): boolean {
  return typeof value === 'string' && value.trim() !== '';
}
