// src/components/layout/mobile-nav.tsx
// The navigation drawer on a narrow screen. It traps focus while it is open,
// closes on the escape key and closes once a destination is chosen.

'use client';

import { Menu, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { SidebarNav } from '@/components/layout/sidebar-nav';
import { Logo } from '@/components/brand/logo';
import { ROUTES } from '@/config/app';
import type { NavSection } from '@/config/navigation';
import { useFocusTrap } from '@/hooks/use-focus-trap';

export interface MobileNavProps {
  /** Sections already filtered for the signed in account. */
  sections: readonly NavSection[];
  /** Name of the business, shown under the brand. */
  companyName: string | null;
}

/**
 * Renders the menu button and the drawer behind it.
 *
 * @param props Navigation sections and the current business.
 * @returns The rendered drawer.
 */
export function MobileNav({ sections, companyName }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useFocusTrap(panelRef, isOpen);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    /**
     * Closes the drawer when the escape key is pressed.
     *
     * @param event Keyboard event from the window.
     * @returns Nothing.
     */
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls="mobile-navigation"
        aria-label="Open the menu"
        onClick={() => {
          setIsOpen(true);
        }}
        className="flex h-11 min-h-touch w-11 min-w-touch items-center justify-center rounded-md text-foreground hover:bg-surface-muted lg:hidden"
      >
        <Menu aria-hidden="true" className="h-5 w-5" />
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-overlay lg:hidden">
          <button
            type="button"
            aria-label="Close the menu"
            onClick={() => {
              setIsOpen(false);
            }}
            className="absolute inset-0 h-full w-full cursor-default bg-black/50"
          />

          <div
            ref={panelRef}
            id="mobile-navigation"
            role="dialog"
            aria-modal="true"
            aria-label="Main menu"
            className="relative flex h-full w-[min(18rem,85vw)] flex-col bg-sidebar shadow-lg"
          >
            <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
              <Logo href={ROUTES.dashboard} isInverted isCompact />
              <button
                type="button"
                aria-label="Close the menu"
                onClick={() => {
                  setIsOpen(false);
                }}
                className="flex h-11 min-h-touch w-11 min-w-touch items-center justify-center rounded-md text-sidebar-muted hover:text-sidebar-foreground"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>

            <SidebarNav
              sections={sections}
              onNavigate={() => {
                setIsOpen(false);
              }}
            />

            {companyName ? (
              <div className="border-t border-sidebar-border px-4 py-4">
                <p className="text-xs uppercase tracking-wide text-sidebar-muted">Business</p>
                <p className="truncate text-sm font-medium text-sidebar-foreground">
                  {companyName}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
