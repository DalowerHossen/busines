// src/app/global-error.tsx
// The last line of defence: shown when the root layout itself fails, so it
// renders its own document and depends on nothing.

'use client';

import { useEffect } from 'react';

export interface GlobalErrorProps {
  /** The error the router caught. */
  error: Error & { digest?: string };
  /** Renders the application again. */
  reset: () => void;
}

/**
 * Renders the failure page for the whole application.
 *
 * @param props The error and the retry function.
 * @returns The rendered document.
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error(
      JSON.stringify({
        level: 'error',
        message: 'The application failed to render',
        digest: error.digest ?? null,
      })
    );
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          backgroundColor: '#f8fafc',
          color: '#0f172a',
        }}
      >
        <main style={{ maxWidth: '32rem', padding: '2rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>
            The application could not start
          </h1>
          <p style={{ color: '#475569', marginBottom: '1.5rem' }}>
            Please try again. If this keeps happening, write to support@kdsolutionit.com and quote
            the reference below.
          </p>
          {error.digest ? (
            <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              Reference: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              minHeight: '44px',
              padding: '0 1.5rem',
              borderRadius: '0.5rem',
              border: 'none',
              backgroundColor: '#1d4ed8',
              color: '#ffffff',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
