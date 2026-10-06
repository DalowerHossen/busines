import { Database, FileKey2, Handshake, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui';

const DPA_COMMITMENTS = [
  {
    icon: Handshake,
    title: 'Processing instructions',
    text: 'Company data is processed to provide the workspace, documents, payments, communications, support, security, and requested integrations.',
  },
  {
    icon: Database,
    title: 'Subprocessor boundaries',
    text: 'Payment, storage, messaging, analytics, and infrastructure providers are used only through documented service boundaries and configured controls.',
  },
  {
    icon: FileKey2,
    title: 'Confidentiality',
    text: 'Access is limited to authorized personnel and systems that need the information to provide, secure, or support the service.',
  },
  {
    icon: RefreshCw,
    title: 'Incident and deletion support',
    text: 'We maintain operational procedures for security notices, data requests, retention, export, and deletion according to applicable obligations.',
  },
];

export function DpaPageContent(): ReactNode {
  return (
    <>
      <section className="mx-auto max-w-content px-4 py-20 sm:px-6 lg:grid lg:grid-cols-[0.8fr_1.2fr] lg:gap-16 lg:px-8 lg:py-28">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">
            Data processing addendum
          </p>
          <h1 className="mt-5 font-heading text-5xl font-semibold tracking-[-0.06em] sm:text-7xl">
            A working boundary for company data.
          </h1>
        </div>
        <div className="border-l-2 border-brand-500 pl-6 text-lg leading-8 text-muted-foreground sm:pl-8">
          This DPA outline describes the processing relationship between a business using KD
          SOLUTION IT and the platform. It is intended to be completed with the applicable order,
          plan, jurisdiction, and negotiated terms before production processing begins.
        </div>
      </section>
      <section className="bg-surface-muted">
        <div className="mx-auto max-w-content px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-5 sm:grid-cols-2">
            {DPA_COMMITMENTS.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="rounded-2xl border border-border bg-card p-7">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h2 className="mt-6 font-heading text-2xl font-semibold tracking-[-0.03em]">
                    {item.title}
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
        <Badge variant="brand">Operational details</Badge>
        <div className="mt-8 divide-y divide-border rounded-2xl border border-border">
          <div className="p-6">
            <h2 className="font-semibold">Data categories</h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              Account identity, company profile, client and document records, payment references,
              communications, support records, security events, and files supplied by the company.
            </p>
          </div>
          <div className="p-6">
            <h2 className="font-semibold">Controller responsibilities</h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              The company remains responsible for lawful collection, notices, permissions,
              instructions, client communications, and the accuracy of its records.
            </p>
          </div>
          <div className="p-6">
            <h2 className="font-semibold">Contact</h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              For DPA requests, contact{' '}
              <a
                className="font-semibold text-brand-700 underline dark:text-brand-300"
                href="mailto:privacy@kdsolutionit.com"
              >
                privacy@kdsolutionit.com
              </a>
              .
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
