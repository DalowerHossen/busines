import type { BotAssessment, SecurityRequestSnapshot, SecurityRouteClass } from './types';

const AI_CRAWLER_PATTERN =
  /(?:GPTBot|ChatGPT-User|CCBot|ClaudeBot|Google-Extended|Bytespider|Amazonbot|PerplexityBot|Applebot-Extended|YouBot|ImagesiftBot|Diffbot|omgili|cohere-ai|PetalBot|FacebookBot)/iu;
const SEO_CRAWLER_PATTERN =
  /(?:Googlebot|Bingbot|DuckDuckBot|Baiduspider|YandexBot|Applebot|Slurp|LinkedInBot|Twitterbot)/iu;
const AUTOMATION_PATTERN =
  /(?:HeadlessChrome|PhantomJS|Playwright|Puppeteer|Selenium|webdriver|Nightmare|browserless)/iu;
const BROWSER_PATTERN = /(?:Mozilla\/5\.0|AppleWebKit|Gecko\/|Chrome\/|Firefox\/|Safari\/)/iu;

export function routeClassForPath(pathname: string): SecurityRouteClass {
  if (
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml'
  ) {
    return 'static';
  }
  if (
    /^\/(?:login|signup|forgot-password|reset-password|verify-email)(?:\/|$)/u.test(pathname) ||
    pathname.startsWith('/api/auth')
  ) {
    return 'auth';
  }
  if (
    /^\/(?:pay|checkout|contact)(?:\/|$)/u.test(pathname) ||
    pathname.startsWith('/api/payment') ||
    pathname.startsWith('/api/checkout')
  ) {
    return 'sensitive';
  }
  if (pathname.startsWith('/api/')) return 'api';
  return 'public';
}

export function assessBotRequest(
  request: SecurityRequestSnapshot,
  routeClass: SecurityRouteClass = routeClassForPath(request.pathname)
): BotAssessment {
  const userAgent = headerValue(request.headers, 'user-agent') ?? '';
  const acceptLanguage = headerValue(request.headers, 'accept-language');
  const secFetchMode = headerValue(request.headers, 'sec-fetch-mode');
  const secChUa = headerValue(request.headers, 'sec-ch-ua');
  const reasons: string[] = [];

  if (AI_CRAWLER_PATTERN.test(userAgent)) {
    reasons.push('known-ai-crawler');
    return {
      action: routeClass === 'public' ? 'allow' : 'block',
      category: 'ai-crawler',
      score: 100,
      reasons,
    };
  }

  if (SEO_CRAWLER_PATTERN.test(userAgent)) {
    return {
      action: 'allow',
      category: 'seo-crawler',
      score: 0,
      reasons: ['recognized-seo-crawler'],
    };
  }

  let score = 0;
  if (!userAgent) {
    score += 35;
    reasons.push('missing-user-agent');
  } else if (!BROWSER_PATTERN.test(userAgent)) {
    score += 20;
    reasons.push('non-browser-user-agent');
  }
  if (AUTOMATION_PATTERN.test(userAgent)) {
    score += 70;
    reasons.push('automation-user-agent');
  }
  if (headerValue(request.headers, 'x-playwright') || headerValue(request.headers, 'x-selenium')) {
    score += 80;
    reasons.push('automation-header');
  }
  if (routeClass !== 'static' && !acceptLanguage && !secChUa && secFetchMode !== 'navigate') {
    score += 15;
    reasons.push('missing-browser-context');
  }

  if (score >= 70 && (routeClass === 'auth' || routeClass === 'sensitive')) {
    return { action: 'challenge', category: 'automation', score, reasons };
  }
  if (
    score >= 35 &&
    (routeClass === 'auth' || routeClass === 'sensitive' || routeClass === 'api')
  ) {
    return { action: 'challenge', category: 'suspicious', score, reasons };
  }
  return { action: 'allow', category: 'none', score, reasons };
}

export function headerValue(
  headers: Readonly<Record<string, string | undefined>>,
  name: string
): string | undefined {
  const wanted = name.toLowerCase();
  return Object.entries(headers).find(([key]) => key.toLowerCase() === wanted)?.[1];
}

export function securityRequestFromHeaders(input: {
  readonly pathname: string;
  readonly method: string;
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly ipAddress?: string;
  readonly accountIdentifier?: string;
}): SecurityRequestSnapshot {
  return input;
}
