'use client';

import { Github, Globe } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui';
import type { OAuthProvider } from './auth-types';

export function OAuthButtons({
  onOAuth,
}: {
  readonly onOAuth?: (provider: OAuthProvider) => Promise<void>;
}): ReactNode {
  const [error, setError] = useState<string | null>(null);
  const start = async (provider: OAuthProvider) => {
    setError(null);
    if (!onOAuth) {
      setError('Social sign-in is not available for this page.');
      return;
    }
    try {
      await onOAuth(provider);
    } catch {
      setError('We could not start social sign-in.');
    }
  };
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => void start('google')}
          leftIcon={<Globe className="h-4 w-4" aria-hidden="true" />}
        >
          Continue with Google
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void start('github')}
          leftIcon={<Github className="h-4 w-4" aria-hidden="true" />}
        >
          Continue with GitHub
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
      <div className="relative py-2">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-card px-3 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Or continue with email
          </span>
        </div>
      </div>
    </div>
  );
}
