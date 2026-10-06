// src/components/layout/user-menu.tsx
// The account menu in the top bar: who is signed in, and the way out.

'use client';

import { LogOut, ShieldCheck, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Avatar } from '@/components/ui/avatar';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { notify } from '@/components/ui/toaster';
import { signOut } from '@/features/auth/actions/sign-out';

export interface UserMenuProps {
  /** Name shown beside the picture. */
  fullName: string;
  /** Address shown under the name. */
  email: string;
  /** Picture of the account, when one has been uploaded. */
  avatarUrl: string | null;
  /** Role of the account, written for a person to read. */
  roleLabel: string;
  /** True when two step verification is already switched on. */
  isTwoFactorEnabled: boolean;
}

/**
 * Renders the account menu.
 *
 * @param props Who is signed in and how they are protected.
 * @returns The rendered menu.
 */
export function UserMenu({
  fullName,
  email,
  avatarUrl,
  roleLabel,
  isTwoFactorEnabled,
}: UserMenuProps) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  /**
   * Ends the session and returns to the sign in page.
   *
   * @returns Nothing.
   */
  async function handleSignOut(): Promise<void> {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    const result = await signOut();

    if (!result.success) {
      setIsSigningOut(false);
      notify.error('You were not signed out', result.error);
      return;
    }

    router.replace(result.data.redirectTo);
    router.refresh();
  }

  return (
    <DropdownMenu
      triggerLabel="Account menu"
      align="end"
      trigger={
        <span className="flex items-center gap-2">
          <Avatar name={fullName} src={avatarUrl} size="sm" />
          <span className="hidden flex-col text-left sm:flex">
            <span className="text-sm font-medium text-foreground">{fullName}</span>
            <span className="text-xs text-muted-foreground">{roleLabel}</span>
          </span>
        </span>
      }
      items={[
        {
          key: 'identity',
          label: email,
          icon: UserRound,
          isDisabled: true,
          onSelect: () => undefined,
        },
        {
          key: 'two-factor',
          label: isTwoFactorEnabled
            ? 'Two step verification is on'
            : 'Two step verification is off',
          icon: ShieldCheck,
          isDisabled: true,
          onSelect: () => undefined,
        },
        {
          key: 'sign-out',
          label: isSigningOut ? 'Signing out' : 'Sign out',
          icon: LogOut,
          isDestructive: true,
          isDisabled: isSigningOut,
          onSelect: () => {
            void handleSignOut();
          },
        },
      ]}
    />
  );
}
