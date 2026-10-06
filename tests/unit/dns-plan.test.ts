// tests/unit/dns-plan.test.ts
// The DNS a working installation needs. Getting this wrong does not break
// loudly; it sends invoices to spam folders, which is worse.

import { describe, expect, it } from 'vitest';

import { buildDomainPlans } from '@/lib/platform/dns-records';

const plans = buildDomainPlans('Example.com', 'kdsolutionit.netlify.app');

describe('planning the domains of an installation', () => {
  it('covers the public site, the application and the sending subdomain', () => {
    const purposes = plans.map((plan) => plan.purpose);

    expect(purposes).toContain('marketing');
    expect(purposes).toContain('app');
    expect(purposes).toContain('mail');
  });

  it('lower cases whatever the person typed', () => {
    expect(plans.every((plan) => plan.hostname === plan.hostname.toLowerCase())).toBe(true);
  });

  it('strips a leading www rather than producing www.www', () => {
    const [first] = buildDomainPlans('www.example.com', 'host.test');

    expect(first?.hostname).toBe('example.com');
  });

  it('asks for a sender policy, a signature and a reporting record on the mail subdomain', () => {
    const mail = plans.find((plan) => plan.purpose === 'mail');
    const types = mail?.records.map((record) => `${record.type} ${record.name}`) ?? [];

    expect(types.some((entry) => entry.startsWith('TXT mail.example.com'))).toBe(true);
    expect(types.some((entry) => entry.includes('_domainkey'))).toBe(true);
    expect(types.some((entry) => entry.includes('_dmarc.mail.example.com'))).toBe(true);
  });

  it('marks the records that are genuinely required', () => {
    const app = plans.find((plan) => plan.purpose === 'app');

    expect(app?.records.every((record) => record.isRequired)).toBe(true);
  });

  it('explains every record, because nobody remembers what a record is for', () => {
    const everyRecord = plans.flatMap((plan) => plan.records);

    expect(everyRecord.every((record) => record.purpose.length > 10)).toBe(true);
  });

  it('points the application at wherever it is actually served from', () => {
    const app = plans.find((plan) => plan.purpose === 'app');

    expect(app?.records[0]?.value).toBe('kdsolutionit.netlify.app');
  });
});
