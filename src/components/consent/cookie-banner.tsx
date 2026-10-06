// src/components/consent/cookie-banner.tsx
// Asks the visitor what may be stored on their device. Nothing beyond the
// strictly necessary cookies loads until an answer is given, and the answer
// can be changed later from the footer.

'use client';

import { Cookie } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ROUTES } from '@/config/app';
import { saveCookieConsent } from '@/features/marketing/actions/save-cookie-consent';
import {
  CONSENT_CATEGORIES,
  CONSENT_COOKIE_NAME,
  decodeConsent,
  isConsentCurrent,
} from '@/lib/consent/cookie-consent';

/** Event any part of the interface can raise to reopen the banner. */
export const OPEN_COOKIE_SETTINGS_EVENT = 'kd:open-cookie-settings';

/** Event raised once a decision has been stored, so listeners can react. */
export const CONSENT_CHANGED_EVENT = 'kd:consent-changed';

interface CategoryChoices {
  analytics: boolean;
  marketing: boolean;
  preferences: boolean;
}

const DENY: CategoryChoices = { analytics: false, marketing: false, preferences: false };
const ALLOW: CategoryChoices = { analytics: true, marketing: true, preferences: true };

/**
 * Reads the consent cookie from the browser.
 *
 * @returns The stored cookie value, or null when it is absent.
 */
function readConsentCookie(): string | null {
  const match = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${CONSENT_COOKIE_NAME}=`));

  return match ? decodeURIComponent(match.slice(CONSENT_COOKIE_NAME.length + 1)) : null;
}

/**
 * Renders the cookie banner and the category panel behind it.
 *
 * @returns The rendered banner, or nothing when an answer is already stored.
 */
export function CookieBanner() {
  const [isOpen, setIsOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [choices, setChoices] = useState<CategoryChoices>(DENY);

  useEffect(() => {
    const stored = decodeConsent(readConsentCookie());

    if (!isConsentCurrent(stored)) {
      setIsOpen(true);
    } else if (stored) {
      setChoices({
        analytics: stored.analytics,
        marketing: stored.marketing,
        preferences: stored.preferences,
      });
    }
  }, []);

  useEffect(() => {
    /**
     * Reopens the banner when the footer link asks for it.
     *
     * @returns Nothing.
     */
    function handleOpenRequest(): void {
      setIsOpen(true);
      setIsDetailOpen(true);
    }

    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, handleOpenRequest);

    return () => {
      window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, handleOpenRequest);
    };
  }, []);

  const save = useCallback(async (decision: CategoryChoices): Promise<void> => {
    setIsSaving(true);
    setError(null);

    const result = await saveCookieConsent(decision);

    setIsSaving(false);

    if (!result.success) {
      setError('Your choice could not be saved. Please try again.');
      return;
    }

    setChoices(decision);
    setIsDetailOpen(false);
    setIsOpen(false);

    // Anything that loads only with permission listens for this, so a new
    // choice takes effect without the visitor reloading the page.
    window.dispatchEvent(new Event(CONSENT_CHANGED_EVENT));
  }, []);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-banner-title"
      className="fixed inset-x-0 bottom-0 z-toast border-t border-border bg-surface p-4 shadow-lg sm:p-5"
    >
      <div className="mx-auto w-full max-w-content space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-3">
            <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 sm:flex">
              <Cookie aria-hidden="true" className="h-5 w-5" />
            </span>
            <div className="space-y-1">
              <h2 id="cookie-banner-title" className="text-base font-semibold text-foreground">
                We ask before we store anything
              </h2>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Strictly necessary cookies keep you signed in and keep forms safe. Analytics and
                marketing cookies load only if you allow them. Read the{' '}
                <Link
                  href={ROUTES.cookiePolicy}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  cookie policy
                </Link>{' '}
                for the detail.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row lg:shrink-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setIsDetailOpen((current) => !current);
              }}
              aria-expanded={isDetailOpen}
            >
              {isDetailOpen ? 'Hide choices' : 'Choose categories'}
            </Button>
            <Button
              type="button"
              variant="outline"
              isLoading={isSaving}
              loadingLabel="Saving"
              onClick={() => {
                void save(DENY);
              }}
            >
              Necessary only
            </Button>
            <Button
              type="button"
              isLoading={isSaving}
              loadingLabel="Saving"
              onClick={() => {
                void save(ALLOW);
              }}
            >
              Accept all
            </Button>
          </div>
        </div>

        {isDetailOpen ? (
          <div className="space-y-3 rounded-lg border border-border bg-surface-muted p-4">
            <ul className="space-y-3">
              {CONSENT_CATEGORIES.map((category) => {
                const key = category.category;
                const checked = key === 'necessary' ? true : choices[key];

                return (
                  <li
                    key={key}
                    className="flex items-start justify-between gap-4 border-b border-border pb-3 last:border-b-0 last:pb-0"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">{category.title}</p>
                      <p className="max-w-2xl text-sm text-muted-foreground">
                        {category.description}
                      </p>
                    </div>

                    <Switch
                      checked={checked}
                      disabled={category.isLocked || isSaving}
                      label={`Allow ${category.title.toLowerCase()} cookies`}
                      onCheckedChange={(next) => {
                        if (key === 'necessary') {
                          return;
                        }

                        setChoices((current) => ({ ...current, [key]: next }));
                      }}
                    />
                  </li>
                );
              })}
            </ul>

            <div className="flex justify-end">
              <Button
                type="button"
                isLoading={isSaving}
                loadingLabel="Saving"
                onClick={() => {
                  void save(choices);
                }}
              >
                Save my choices
              </Button>
            </div>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
