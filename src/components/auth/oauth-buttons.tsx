// src/components/auth/oauth-buttons.tsx
// Signing in with a provider. The button says which provider it is, shows
// that it is working, and explains itself if the provider cannot be reached.

'use client';

import { Github, Chrome } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { startOAuth } from '@/features/auth/actions/start-oauth';
import { OAUTH_PROVIDERS } from '@/lib/auth/oauth';

export interface OAuthButtonsProps {
  /** Page to open once the provider has returned. */
  nextPath?: string | null;
  /** Disables the buttons while another form on the page is working. */
  isDisabled?: boolean;
}

const ICONS = {
  google: Chrome,
  github: Github,
} as const;

/**
 * Renders one button per supported provider.
 *
 * @param props Where to continue to and whether the page is busy.
 * @returns The rendered buttons.
 */
export function OAuthButtons({ nextPath = null, isDisabled = false }: OAuthButtonsProps) {
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Starts the exchange and sends the browser to the provider.
   *
   * @param provider Provider that was chosen.
   * @returns Nothing.
   */
  async function start(provider: 'google' | 'github'): Promise<void> {
    setPendingProvider(provider);
    setError(null);

    const result = await startOAuth({ provider, nextPath });

    if (!result.success) {
      setPendingProvider(null);
      setError(result.error);
      return;
    }

    window.location.assign(result.data.authorizationUrl);
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {OAUTH_PROVIDERS.map((definition) => {
          const Icon = ICONS[definition.provider];

          return (
            <Button
              key={definition.provider}
              type="button"
              variant="outline"
              fullWidth
              disabled={isDisabled || pendingProvider !== null}
              isLoading={pendingProvider === definition.provider}
              loadingLabel="Opening"
              leadingIcon={<Icon className="h-4 w-4" />}
              onClick={() => {
                void start(definition.provider);
              }}
            >
              {definition.label}
            </Button>
          );
        })}
      </div>

      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
