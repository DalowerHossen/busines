// src/components/consent/cookie-settings-link.tsx
// The footer link that reopens the cookie banner, so a decision can be
// changed on any page without hunting through browser settings.

'use client';

import { OPEN_COOKIE_SETTINGS_EVENT } from '@/components/consent/cookie-banner';

/**
 * Renders the link that reopens the cookie choices.
 *
 * @returns The rendered link.
 */
export function CookieSettingsLink() {
  return (
    <button
      type="button"
      onClick={() => {
        window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT));
      }}
      className="inline-flex min-h-touch items-center text-left text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
    >
      Cookie settings
    </button>
  );
}
