// src/components/developers/consent-card.tsx
// The moment an owner decides whether to let an application in. Everything
// the application will be able to do is written out in plain words first.

'use client';

import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { authoriseApp } from '@/features/developers/actions/authorise-app';
import type { AuthorisationRequest } from '@/features/developers/queries/get-authorisation-request';

export interface ConsentCardProps {
  /** The application asking, and what it is asking for. */
  request: AuthorisationRequest;
  /** Public identifier the application sent. */
  clientId: string;
  /** Opaque value handed back untouched, when the application sent one. */
  state: string | null;
  /** Proof key sent by a public client, when there is one. */
  codeChallenge: string | null;
  /** How that proof key was built. */
  codeChallengeMethod: 'S256' | 'plain' | null;
}

/**
 * Renders the consent screen.
 *
 * @param props The request and the values that travel with it.
 * @returns The rendered card.
 */
export function ConsentCard({
  request,
  clientId,
  state,
  codeChallenge,
  codeChallengeMethod,
}: ConsentCardProps) {
  const [isWorking, setIsWorking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  /**
   * Issues the authorisation and sends the person back to the application.
   *
   * @returns Nothing.
   */
  async function onAllow(): Promise<void> {
    setIsWorking(true);
    setFailure(null);

    const result = await authoriseApp({
      clientId,
      redirectUri: request.redirectUri,
      scopes: request.requestedScopes.map((scope) => scope.key),
      state: state ?? undefined,
      codeChallenge: codeChallenge ?? undefined,
      codeChallengeMethod: codeChallengeMethod ?? undefined,
    });

    if (!result.success) {
      setIsWorking(false);
      setFailure(result.error);

      return;
    }

    window.location.assign(result.data.redirectTo);
  }

  /**
   * Sends the person back to the application having refused.
   *
   * @returns Nothing.
   */
  function onRefuse(): void {
    const target = new URL(request.redirectUri);
    target.searchParams.set('error', 'access_denied');

    if (state) {
      target.searchParams.set('state', state);
    }

    window.location.assign(target.toString());
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{request.appName} would like access</CardTitle>
        <CardDescription>
          {request.tagline ?? 'An application is asking to work with this account.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {failure ? (
          <Alert tone="danger" title="That did not work">
            {failure}
          </Alert>
        ) : null}

        {request.refusalReason ? (
          <Alert tone="danger" title="This request cannot go ahead">
            {request.refusalReason}
          </Alert>
        ) : null}

        <div className="space-y-3">
          <p className="text-sm font-medium">If you allow it, this application can:</p>
          <ul className="space-y-2">
            {request.requestedScopes.map((scope) => (
              <li key={scope.key} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{scope.label}</span>
                  <Badge tone={scope.isWrite ? 'warning' : 'neutral'}>
                    {scope.isWrite ? 'Can change things' : 'Read only'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{scope.description}</p>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-sm text-muted-foreground">
          You can take this access back at any time from Settings, Connected applications. It will
          be sent back to {request.redirectUri}.
        </p>

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={onRefuse}>
            Not now
          </Button>
          <Button
            type="button"
            isLoading={isWorking}
            loadingLabel="Connecting"
            disabled={request.refusalReason !== null}
            onClick={() => {
              void onAllow();
            }}
          >
            Allow access
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
