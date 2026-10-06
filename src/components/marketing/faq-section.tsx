// src/components/marketing/faq-section.tsx
// The questions people ask before signing up, each with a real answer. The
// answers use the native disclosure element, so they work without JavaScript
// and are reachable from the keyboard.

import { ChevronDown } from 'lucide-react';

import { FAQ, type FaqEntry } from '@/config/marketing';

export interface FaqSectionProps {
  /** Heading above the list. */
  title?: string;
  /** Sentence under the heading. */
  description?: string;
  /** Questions to show; the general list is used when none is given. */
  entries?: readonly FaqEntry[];
}

/**
 * Renders a list of frequently asked questions.
 *
 * @param props Heading, description and the questions to show.
 * @returns The rendered section.
 */
export function FaqSection({
  title = 'Questions people ask before signing up',
  description,
  entries = FAQ,
}: FaqSectionProps) {
  return (
    <section className="border-b border-border bg-background">
      <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h2>

        {description ? <p className="mt-3 text-muted-foreground">{description}</p> : null}

        <div className="mt-8 divide-y divide-border rounded-lg border border-border bg-surface">
          {entries.map((entry) => (
            <details key={entry.question} className="group px-5 py-4">
              <summary className="flex min-h-touch cursor-pointer list-none items-center justify-between gap-4 text-left text-sm font-medium text-foreground">
                {entry.question}
                <ChevronDown
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                />
              </summary>
              <p className="pt-3 text-sm text-muted-foreground">{entry.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
