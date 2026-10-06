// src/app/(app)/dashboard/developers/page.tsx
// The developer portal: the applications this account has built, and the
// credentials they connect with.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { AppList } from '@/components/developers/app-list';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadMyDeveloperApps } from '@/features/developers/queries/list-my-apps';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Developer portal',
  description: 'Build an application that works with your account data.',
  path: `${ROUTES.dashboard}/developers`,
  noIndex: true,
});

/**
 * Renders the developer portal.
 *
 * @returns The rendered page.
 */
export default async function DevelopersPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  if (user.role !== 'owner' && user.role !== 'super_admin') {
    return (
      <>
        <PageHeader
          title="Developer portal"
          description="Applications are registered by the owner of the business."
        />
        <Alert tone="info" title="Ask the owner to register the application">
          An application connects on behalf of the whole business, so only the owner can register
          one or replace its secret.
        </Alert>
      </>
    );
  }

  const { apps, isDegraded } = await loadMyDeveloperApps();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Developer portal"
        description="Build against the same interface our own integrations use. Register an application, choose the permissions it needs, and connect it to any account that allows it."
      />

      {isDegraded ? (
        <Alert tone="warning" title="Your applications could not be read">
          Nothing has been changed. Try again in a moment before you register anything new.
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>How an application connects</CardTitle>
          <CardDescription>
            Three steps, and the same three steps for an automation service, a browser extension or
            a script of your own.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>
              Send the owner to <span className="font-mono">/oauth/authorize</span> with your client
              identifier, your return address and the permissions you need.
            </li>
            <li>
              Trade the code you receive for a token at{' '}
              <span className="font-mono">/api/oauth/token</span>, sending your client secret.
            </li>
            <li>
              Call <span className="font-mono">/api/v1</span> with that token in the authorization
              header. Every answer carries the remaining allowance in its headers.
            </li>
          </ol>
        </CardContent>
      </Card>

      <AppList apps={apps} />
    </div>
  );
}
