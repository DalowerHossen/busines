// src/components/layout/command-launcher.tsx
// Owns the open state of the command palette and the keyboard shortcut that
// reaches it. Kept separate from the palette itself so the frame around a
// workspace can stay a Server Component.

'use client';

import { Search } from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { CommandPalette } from '@/components/layout/command-palette';
import type { AccountRole } from '@/types/auth';

export interface CommandLauncherProps {
  /** Role of the signed in account, used to filter what the palette offers. */
  role: AccountRole | null;
}

/**
 * Renders the palette trigger and the palette itself.
 *
 * @param props The role the palette is filtered for.
 * @returns The rendered launcher.
 */
export function CommandLauncher({ role }: CommandLauncherProps): ReactNode {
  const [isOpen, setIsOpen] = useState(false);

  const onKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      setIsOpen((open) => !open);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onKeyDown]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex min-h-touch items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm text-muted-foreground"
      >
        <Search className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden rounded border border-border px-1 text-xs lg:inline">Ctrl K</kbd>
      </button>

      <CommandPalette role={role} open={isOpen} onOpenChange={setIsOpen} />
    </>
  );
}
