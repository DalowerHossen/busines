// src/components/marketing/how-it-works.tsx
// Three steps from an empty account to money in the bank.

import { HOW_IT_WORKS } from '@/config/marketing';

/**
 * Renders the three step explanation.
 *
 * @returns The rendered section.
 */
export function HowItWorks() {
  return (
    <section className="border-b border-border bg-surface-muted">
      <div className="mx-auto w-full max-w-content px-4 py-16 sm:px-6">
        <div className="max-w-2xl space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            From draft to paid in three steps
          </h2>
          <p className="text-muted-foreground">
            The first invoice takes about a minute. Every one after that takes less.
          </p>
        </div>

        <ol className="mt-10 grid gap-6 md:grid-cols-3">
          {HOW_IT_WORKS.map((step, index) => (
            <li
              key={step.title}
              className="relative flex h-full flex-col gap-3 rounded-lg border border-border bg-surface p-6"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {index + 1}
              </span>
              <h3 className="text-base font-semibold text-foreground">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
