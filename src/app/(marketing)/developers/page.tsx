// src/app/(marketing)/developers/page.tsx
// The public developer page: how an outside tool connects to a business,
// and what it can do once it has been allowed in.

import type { Metadata } from 'next';
import Link from 'next/link';

import { ClosingCta } from '@/components/marketing/closing-cta';
import { SectionHeading } from '@/components/marketing/section-heading';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ROUTES } from '@/config/app';
import {
  DEVELOPERS_PAGE_INTRO,
  INTEGRATION_ROUTES,
  INTERFACE_RULES,
  PUBLIC_ENDPOINTS,
} from '@/config/content/developers-page';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'For developers',
  description:
    'Connect your own tools, an automation service or a browser extension to your invoicing, with scoped permissions an owner can take back at any time.',
  path: ROUTES.developerDocs,
});

/**
 * Renders the public developer page.
 *
 * @returns The rendered page.
 */
export default function DevelopersPage() {
  return (
    <>
      <section className="border-b border-border bg-gradient-to-b from-brand-50 to-background">
        <div className="mx-auto w-full max-w-content px-4 py-16 sm:px-6">
          <SectionHeading
            level="h1"
            eyebrow={DEVELOPERS_PAGE_INTRO.eyebrow}
            title={DEVELOPERS_PAGE_INTRO.title}
            description={DEVELOPERS_PAGE_INTRO.description}
          />

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href={ROUTES.register} className={buttonVariants({ size: 'lg' })}>
              Start free
            </Link>
            <Link
              href={ROUTES.contact}
              className={buttonVariants({ variant: 'outline', size: 'lg' })}
            >
              Talk to us about an integration
            </Link>
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto w-full max-w-content px-4 py-16 sm:px-6">
          <SectionHeading
            title="Three ways in"
            description="Pick the one that matches what you are building. All three end in the same place: a token scoped to one business, granted by its owner."
          />

          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {INTEGRATION_ROUTES.map((route) => (
              <Card key={route.key}>
                <CardHeader>
                  <CardTitle>{route.title}</CardTitle>
                  <CardDescription>{route.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                    {route.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-surface-muted">
        <div className="mx-auto w-full max-w-content px-4 py-16 sm:px-6">
          <SectionHeading
            title="What you can call"
            description="A small interface that grows with demand. Every endpoint needs a permission the owner has granted."
          />

          <div className="mt-8">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Method</TableHead>
                  <TableHead>Path</TableHead>
                  <TableHead>What it does</TableHead>
                  <TableHead>Permission</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {PUBLIC_ENDPOINTS.map((endpoint) => (
                  <TableRow key={endpoint.path}>
                    <TableCell>
                      <Badge tone={endpoint.method === 'GET' ? 'neutral' : 'info'}>
                        {endpoint.method}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">{endpoint.path}</span>
                    </TableCell>
                    <TableCell>{endpoint.description}</TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">{endpoint.scope}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto w-full max-w-content px-4 py-16 sm:px-6">
          <SectionHeading
            title="The rules, stated once"
            description="None of this changes without notice, and none of it is negotiable per application."
          />

          <ul className="mt-8 grid gap-4 md:grid-cols-2">
            {INTERFACE_RULES.map((rule) => (
              <li key={rule} className="rounded-lg border border-border bg-surface p-4 text-sm">
                {rule}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-b border-border bg-surface-muted">
        <div className="mx-auto w-full max-w-content px-4 py-16 sm:px-6">
          <SectionHeading
            title="The description, in a form your tools can read"
            description="A written description of every endpoint, its scopes and its paging, served from the same deployment it describes so the two cannot drift apart."
          />

          <div className="mt-8 flex flex-wrap gap-3">
            {/* These point at API route handlers that return JSON, not pages,
                so an anchor is deliberate and next/link must not prefetch them. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/api/v1/openapi"
              className="inline-flex min-h-touch items-center rounded-md bg-brand-600 px-5 text-sm font-medium text-white shadow-xs"
            >
              Read the interface description
            </a>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/api/v1/ping"
              className="inline-flex min-h-touch items-center rounded-md border border-border bg-surface px-5 text-sm font-medium text-foreground"
            >
              Try a request
            </a>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            Point a client generator at the description and you have a working library in a minute.
            Every response carries your remaining allowance in its headers, and a refused request
            tells you how long to wait rather than leaving you to guess.
          </p>
        </div>
      </section>

      <ClosingCta />
    </>
  );
}
