import 'server-only';

export interface EmailDomainReputationResult {
  readonly allowed: boolean;
  readonly reason: 'allowed' | 'invalid' | 'disposable' | 'reputation-failed';
}

export interface EmailDomainReputationChecker {
  check(domain: string): Promise<EmailDomainReputationResult>;
}

export function normalizeEmailDomain(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const atIndex = trimmed.lastIndexOf('@');
  if (atIndex < 1 || atIndex === trimmed.length - 1 || /[\r\n]/u.test(trimmed)) return '';
  const domain = trimmed.slice(atIndex + 1);
  if (domain.length > 253 || domain.includes('..') || !/^[a-z0-9.-]+$/u.test(domain)) return '';
  return domain;
}

export async function assessSignupEmail(
  email: string,
  checker: EmailDomainReputationChecker
): Promise<EmailDomainReputationResult> {
  const domain = normalizeEmailDomain(email);
  if (!domain) return { allowed: false, reason: 'invalid' };
  const result = await checker.check(domain);
  if (result.reason === 'disposable' || result.reason === 'reputation-failed') {
    return { allowed: false, reason: result.reason };
  }
  return result.allowed
    ? { allowed: true, reason: 'allowed' }
    : { allowed: false, reason: 'reputation-failed' };
}
