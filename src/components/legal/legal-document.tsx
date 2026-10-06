// src/components/legal/legal-document.tsx
// Renders a legal document with its version, its date and a table of contents,
// so a long page stays navigable on a phone as well as on a desktop.

import { formatDate } from '@/lib/dates';
import type { LegalDocument as LegalDocumentContent } from '@/content/legal/types';

export interface LegalDocumentProps {
  /** The document to render. */
  document: LegalDocumentContent;
}

/**
 * Renders one legal document.
 *
 * @param props The document to render.
 * @returns The rendered page body.
 */
export function LegalDocumentView({ document }: LegalDocumentProps) {
  return (
    <article className="mx-auto w-full max-w-content px-4 py-12 sm:px-6">
      <header className="max-w-3xl space-y-3 border-b border-border pb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {document.title}
        </h1>
        <p className="text-base text-muted-foreground">{document.summary}</p>
        <p className="text-sm text-muted-foreground">
          Version {document.version}. In effect from {formatDate(document.effectiveDate)}.
        </p>
      </header>

      <div className="mt-8 gap-10 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
        <nav aria-label="On this page" className="mb-8 lg:mb-0">
          <div className="lg:sticky lg:top-24">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              On this page
            </h2>
            <ol className="mt-3 space-y-1">
              {document.sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="flex min-h-touch items-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    {section.heading}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>

        <div className="max-w-3xl space-y-10">
          {document.sections.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-24 space-y-3">
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                {section.heading}
              </h2>

              {section.paragraphs.map((paragraph) => (
                <p
                  key={paragraph.slice(0, 48)}
                  className="text-base leading-relaxed text-muted-foreground"
                >
                  {paragraph}
                </p>
              ))}

              {section.bullets ? (
                <ul className="list-disc space-y-2 pl-5 text-base leading-relaxed text-muted-foreground">
                  {section.bullets.map((bullet) => (
                    <li key={bullet.slice(0, 48)}>{bullet}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}
