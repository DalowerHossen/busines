// src/lib/platform/dns-records.ts
// The DNS a working installation needs, written out rather than remembered.
//
// Mail is the part that silently fails. An invoice sent from a domain with
// no sender policy, no signature and no reporting record does not bounce; it
// quietly lands in a spam folder and the seller concludes the platform is
// broken. So the records are generated here, shown in full, and checked.

import 'server-only';

export interface DnsRecord {
  /** What kind of record this is. */
  type: 'A' | 'AAAA' | 'CNAME' | 'TXT' | 'MX';
  /** The name the record sits at. */
  name: string;
  /** What the record has to contain. */
  value: string;
  /** Why it is needed, in one sentence. */
  purpose: string;
  /** True when a missing record breaks something immediately. */
  isRequired: boolean;
}

export interface DomainPlan {
  purpose: 'app' | 'marketing' | 'short_link' | 'mail' | 'assets';
  hostname: string;
  records: readonly DnsRecord[];
}

/**
 * Builds the records every hostname of an installation needs.
 *
 * @param rootDomain The domain the business owns, such as example.com.
 * @param hostTarget Where the application is actually served from.
 * @returns One plan per hostname, each with its records.
 */
export function buildDomainPlans(rootDomain: string, hostTarget: string): readonly DomainPlan[] {
  const root = rootDomain
    .trim()
    .toLowerCase()
    .replace(/^www\./, '');
  const target = hostTarget.trim().toLowerCase();

  return [
    {
      purpose: 'marketing',
      hostname: root,
      records: [
        {
          type: 'CNAME',
          name: `www.${root}`,
          value: target,
          purpose: 'Points the public site at this application.',
          isRequired: true,
        },
        {
          type: 'TXT',
          name: root,
          value: 'v=spf1 include:_spf.mx.cloudflare.net -all',
          purpose: 'Says which servers may send mail as this domain.',
          isRequired: true,
        },
        {
          type: 'TXT',
          name: `_dmarc.${root}`,
          value: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${root}; adkim=s; aspf=s`,
          purpose: 'Tells receiving servers what to do with mail that fails the checks.',
          isRequired: true,
        },
      ],
    },
    {
      purpose: 'app',
      hostname: `app.${root}`,
      records: [
        {
          type: 'CNAME',
          name: `app.${root}`,
          value: target,
          purpose: 'Where businesses sign in and where client links point.',
          isRequired: true,
        },
      ],
    },
    {
      purpose: 'mail',
      hostname: `mail.${root}`,
      records: [
        {
          type: 'TXT',
          name: `mail.${root}`,
          value: 'v=spf1 include:_spf.mx.cloudflare.net -all',
          purpose: 'Authorises the sending service for this subdomain.',
          isRequired: true,
        },
        {
          type: 'CNAME',
          name: `resend._domainkey.mail.${root}`,
          value: `resend._domainkey.${target}`,
          purpose: 'Carries the signature that proves an invoice came from you.',
          isRequired: true,
        },
        {
          type: 'TXT',
          name: `_dmarc.mail.${root}`,
          value: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${root}`,
          purpose: 'Reports on mail sent from the sending subdomain.',
          isRequired: true,
        },
        {
          type: 'MX',
          name: `mail.${root}`,
          value: `10 feedback-smtp.${target}`,
          purpose: 'Receives the bounce reports for mail you send.',
          isRequired: false,
        },
      ],
    },
    {
      purpose: 'short_link',
      hostname: `go.${root}`,
      records: [
        {
          type: 'CNAME',
          name: `go.${root}`,
          value: target,
          purpose: 'The short domain used in reminders and messages.',
          isRequired: false,
        },
      ],
    },
    {
      purpose: 'assets',
      hostname: `assets.${root}`,
      records: [
        {
          type: 'CNAME',
          name: `assets.${root}`,
          value: target,
          purpose: 'Serves logos and generated documents close to the reader.',
          isRequired: false,
        },
      ],
    },
  ];
}

export interface RecordCheck {
  record: DnsRecord;
  isPresent: boolean;
  found: readonly string[];
}

/** Where a DNS question is asked, since this server has no resolver of its own. */
const RESOLVER = 'https://cloudflare-dns.com/dns-query';

const RECORD_TYPES: Readonly<Record<DnsRecord['type'], number>> = {
  A: 1,
  AAAA: 28,
  CNAME: 5,
  TXT: 16,
  MX: 15,
};

/**
 * Asks a public resolver what a name currently holds.
 *
 * @param record The record being checked.
 * @returns Whether it is present, and what was actually found.
 */
export async function checkDnsRecord(record: DnsRecord): Promise<RecordCheck> {
  try {
    const response = await fetch(
      `${RESOLVER}?name=${encodeURIComponent(record.name)}&type=${String(RECORD_TYPES[record.type])}`,
      {
        headers: { accept: 'application/dns-json' },
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!response.ok) {
      return { record, isPresent: false, found: [] };
    }

    const payload: unknown = await response.json();
    const answers =
      typeof payload === 'object' && payload !== null && 'Answer' in payload
        ? (payload as { Answer: unknown }).Answer
        : null;

    if (!Array.isArray(answers)) {
      return { record, isPresent: false, found: [] };
    }

    const found = answers.flatMap((answer) => {
      if (typeof answer !== 'object' || answer === null || !('data' in answer)) {
        return [];
      }

      return [String((answer as { data: unknown }).data).replace(/^"|"$/g, '')];
    });

    const wanted = record.value.toLowerCase().replace(/\.$/, '');
    const isPresent = found.some((entry) => {
      const actual = entry.toLowerCase().replace(/\.$/, '');

      // A sender policy or signature record is matched loosely, because
      // providers legitimately add their own terms to it.
      return actual === wanted || actual.includes(wanted) || wanted.includes(actual);
    });

    return { record, isPresent, found };
  } catch {
    return { record, isPresent: false, found: [] };
  }
}
