// src/app/oauth/authorize/page.tsx
// The consent screen. An application sends the owner here, the owner reads
// exactly what is being asked for, and nothing is issued until they agree.

import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Logo } from '@/components/brand/logo';
import { ConsentCard } from '@/components/developers/consent-card';
import { Alert } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { ROUTES } from '@/config/app';
import { loadAuthorisationRequest } from '@/features/developers/queries/get-authorisation-request';
import { loadCompany } from '@/lib/auth/company-context';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Allow access',
  description: 'Decide whether an application may work with your account.',
  path: '/oauth/authorize',
  noIndex: true,
});

export interface AuthorizePageProps {
  /** The query the application sent the owner here with. */
  searchParams: Record<string, string | string[] | undefined>;
}

/**
 * Reads one query value, ignoring repeats.
 *
 * @param value Raw query value.
 * @returns The single value, or null.
 */
function single(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

/**
 * Renders the consent screen.
 *
 * @param props The query the application sent.
 * @returns The rendered page.
 */
export default async function AuthorizePage({ searchParams }: AuthorizePageProps) {
  const clientId = single(searchParams.client_id);
  const redirectUri = single(searchParams.redirect_uri);
  const scopeParam = single(searchParams.scope) ?? '';
  const state = single(searchParams.state);
  const codeChallenge = single(searchParams.code_challenge);
  const methodParam = single(searchParams.code_challenge_method);
  const codeChallengeMethod =
    methodParam === 'S256' || methodParam === 'plain' ? methodParam : null;

  const user = await getSessionUser();

  if (!user) {
    const next = encodeURIComponent(
      `/oauth/authorize?${new URLSearchParams(
        Object.entries({
          client_id: clientId ?? '',
          redirect_uri: redirectUri ?? '',
          scope: scopeParam,
          ...(state ? { state } : {}),
          ...(codeChallenge ? { code_challenge: codeChallenge } : {}),
          ...(codeChallengeMethod ? { code_challenge_method: codeChallengeMethod } : {}),
        })
      ).toString()}`
    );

    redirect(`${ROUTES.login}?next=${next}`);
  }

  const scopes = scopeParam
    .split(/[\s,]+/)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  const request =
    clientId && redirectUri ? await loadAuthorisationRequest(clientId, redirectUri, scopes) : null;

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center gap-6 px-4 py-10">
      <Logo />

      {request === null ? (
        <Alert tone="danger" title="This request is not valid">
          The application behind this link could not be recognised, or the address it asked to be
          returned to is not one it has registered. Go back to the application and start again.
        </Alert>
      ) : user.role !== 'owner' && user.role !== 'super_admin' ? (
        <Alert tone="warning" title="Only the owner can allow this">
          An application connects on behalf of the whole business, so the owner has to be the one
          who agrees. Ask them to open this link.
        </Alert>
      ) : company === null ? (
        <Alert tone="warning" title="No business is attached to this account">
          Finish setting up your business first, then open this link again.
        </Alert>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            You are signed in as {user.email} for {company.displayName}.
          </p>
          <ConsentCard
            request={request}
            clientId={clientId ?? ''}
            state={state}
            codeChallenge={codeChallenge}
            codeChallengeMethod={codeChallengeMethod}
          />
        </>
      )}

      <Link href={ROUTES.dashboard} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
        Back to your dashboard
      </Link>
    </main>
  );
}
