import { Activity, CheckCircle2, Clock3 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui';
import { PUBLIC_STATUS_SERVICES } from './public-pages-data';

export function StatusPageContent(): ReactNode {
  return (
    <>
      <section className="bg-sidebar text-sidebar-foreground">
        <div className="mx-auto max-w-content px-4 py-20 sm:px-6 lg:flex lg:items-end lg:justify-between lg:px-8 lg:py-28">
          <div>
            <Badge variant="brand">System status</Badge>
            <h1 className="mt-6 font-heading text-5xl font-semibold tracking-[-0.06em] sm:text-7xl">
              The important work should keep moving.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-sidebar-muted">
              A transparent view of the public service areas that support your workspace.
            </p>
          </div>
          <div className="mt-10 flex items-center gap-3 rounded-full border border-success/30 bg-success/10 px-5 py-3 text-sm font-semibold text-success-foreground lg:mt-0">
            <span className="h-2.5 w-2.5 rounded-full bg-success" aria-hidden="true" />
            All systems operational
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center gap-3">
          <Activity className="h-5 w-5 text-brand-700 dark:text-brand-300" aria-hidden="true" />
          <h2 className="font-heading text-2xl font-semibold">Current services</h2>
        </div>
        <div className="divide-y divide-border rounded-2xl border border-border bg-card">
          {PUBLIC_STATUS_SERVICES.map((service) => (
            <div
              key={service.name}
              className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <h3 className="font-semibold">{service.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{service.detail}</p>
              </div>
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-success-foreground">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                {service.status}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-8 flex gap-3 rounded-xl bg-surface-muted p-5 text-sm leading-6 text-muted-foreground">
          <Clock3
            className="h-5 w-5 shrink-0 text-brand-700 dark:text-brand-300"
            aria-hidden="true"
          />
          Past incidents and maintenance notices are recorded by the platform operations team and
          published here when the status service is connected.
        </div>
      </section>
    </>
  );
}
