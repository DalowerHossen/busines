import { Eye, Fingerprint, KeyRound, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

const PRIVACY_PILLARS = [
  {
    icon: Eye,
    title: 'Purpose-limited collection',
    text: 'We use business and account information to provide the workspace, protect it, process requested actions, and communicate service changes.',
  },
  {
    icon: KeyRound,
    title: 'Controlled access',
    text: 'Access to private records is limited by company membership, capability, server-side checks, and operational need.',
  },
  {
    icon: Fingerprint,
    title: 'Evidence with boundaries',
    text: 'Security and payment events may retain timestamps, request context, and consent evidence when the workflow requires it.',
  },
  {
    icon: ShieldCheck,
    title: 'Provider separation',
    text: 'Storage, payment, messaging, and analytics connections are bounded services. Credentials remain server-owned.',
  },
];

export function PrivacyPageContent(): ReactNode {
  return (
    <>
      <section className="border-b border-border bg-surface-muted">
        <div className="mx-auto max-w-content px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <Badge variant="brand">Privacy</Badge>
          <h1 className="mt-6 max-w-4xl font-heading text-5xl font-semibold tracking-[-0.06em] sm:text-7xl">
            Privacy should be understandable before it is accepted.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            This page explains the practical principles behind how KD SOLUTION IT handles account,
            company, client, payment, and support information.
          </p>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-brand-700 dark:text-brand-300">
            Version 1.0 · Effective October 6, 2026
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-content px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-5 sm:grid-cols-2">
          {PRIVACY_PILLARS.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <Card key={pillar.title} className="border-t-4 border-t-brand-500">
                <CardHeader>
                  <Icon className="h-6 w-6 text-brand-700 dark:text-brand-300" aria-hidden="true" />
                  <CardTitle className="mt-4 text-xl">{pillar.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-7 text-muted-foreground">{pillar.text}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
      <section className="bg-sidebar text-sidebar-foreground">
        <div className="mx-auto grid max-w-content gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-300">
              Your choices
            </p>
            <h2 className="mt-4 font-heading text-4xl font-semibold tracking-[-0.05em]">
              Access, correct, export, or request deletion.
            </h2>
          </div>
          <div className="grid gap-5 text-sm leading-7 text-sidebar-muted">
            <p>
              Depending on your role and applicable law, you may ask for access to account
              information, request correction, export business data, manage communication
              preferences, or request account closure.
            </p>
            <p>
              Retention can vary when a record is needed for security, financial reconciliation,
              dispute evidence, legal obligations, or an active support request. We keep the reason
              and policy boundary explicit rather than silently retaining everything forever.
            </p>
            <p>
              For a privacy request, contact{' '}
              <a
                className="font-semibold text-brand-300 underline"
                href="mailto:privacy@kdsolutionit.com"
              >
                privacy@kdsolutionit.com
              </a>
              . Do not include passwords, payment credentials, or identity documents in an
              unencrypted email.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
