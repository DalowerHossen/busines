// src/components/team/invitation-table.tsx
// Invitations that have been created but not accepted yet, with a way to
// issue a fresh link or withdraw one.

'use client';

import { Copy, Link2, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { notify } from '@/components/ui/toaster';
import { absoluteUrl } from '@/env/client';
import { renewInvitation } from '@/features/team/actions/renew-invitation';
import { revokeInvitation } from '@/features/team/actions/revoke-invitation';
import type { TeamInvitation } from '@/features/team/types';
import { formatDate } from '@/lib/dates';

export interface InvitationTableProps {
  /** Invitations waiting to be accepted. */
  invitations: readonly TeamInvitation[];
  /** False when the signed in account may only read. */
  canManage: boolean;
}

/**
 * Renders the outstanding invitations.
 *
 * @param props The invitations and what the viewer may do with them.
 * @returns The rendered table.
 */
export function InvitationTable({ invitations, canManage }: InvitationTableProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [issuedLink, setIssuedLink] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  /**
   * Issues a fresh link for one invitation.
   *
   * @param invitationId Invitation to refresh.
   * @returns Nothing.
   */
  async function renew(invitationId: string): Promise<void> {
    setBusyId(invitationId);
    setFormError(null);

    const result = await renewInvitation({ invitationId });
    setBusyId(null);

    if (!result.success) {
      setFormError(result.error);
      return;
    }

    setIssuedLink(absoluteUrl(result.data.invitationPath));
    notify.success('A fresh link has been issued. The previous one no longer works.');
    router.refresh();
  }

  /**
   * Withdraws one invitation.
   *
   * @param invitationId Invitation to withdraw.
   * @returns Nothing.
   */
  async function revoke(invitationId: string): Promise<void> {
    setBusyId(invitationId);
    setFormError(null);

    const result = await revokeInvitation({ invitationId });
    setBusyId(null);

    if (!result.success) {
      setFormError(result.error);
      return;
    }

    setIssuedLink(null);
    notify.success('The invitation has been withdrawn.');
    router.refresh();
  }

  /**
   * Copies the freshly issued link.
   *
   * @returns Nothing.
   */
  async function copyLink(): Promise<void> {
    if (!issuedLink || typeof navigator === 'undefined' || !navigator.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(issuedLink);
    notify.success('Link copied.');
  }

  if (invitations.length === 0) {
    return (
      <EmptyState
        title="No invitations are waiting"
        description="When you invite somebody, their invitation appears here until it is accepted."
      />
    );
  }

  return (
    <div className="space-y-4">
      {formError ? (
        <Alert tone="danger" title="That did not work">
          {formError}
        </Alert>
      ) : null}

      {issuedLink ? (
        <Alert tone="success" title="Share this link with the person you invited">
          <p className="break-all">{issuedLink}</p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-3"
            leadingIcon={<Copy aria-hidden="true" className="h-4 w-4" />}
            onClick={() => {
              void copyLink();
            }}
          >
            Copy link
          </Button>
        </Alert>
      ) : null}

      <Table caption="Invitations waiting to be accepted">
        <TableHeader>
          <TableRow>
            <TableHead>Invited</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Sent</TableHead>
            <TableHead>Valid until</TableHead>
            <TableHead>
              <span className="visually-hidden">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invitations.map((invitation) => (
            <TableRow key={invitation.id}>
              <TableCell>
                <span className="block font-medium text-foreground">
                  {invitation.fullName ?? invitation.email}
                </span>
                <span className="block text-sm text-muted-foreground">{invitation.email}</span>
              </TableCell>
              <TableCell>
                <Badge tone="neutral">
                  {invitation.role === 'accountant' ? 'Accountant' : 'Staff'}
                </Badge>
              </TableCell>
              <TableCell>{formatDate(invitation.invitedAt)}</TableCell>
              <TableCell>
                {invitation.isExpired ? (
                  <Badge tone="warning">Expired {formatDate(invitation.expiresAt)}</Badge>
                ) : (
                  formatDate(invitation.expiresAt)
                )}
              </TableCell>
              <TableCell>
                {canManage ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      isLoading={busyId === invitation.id}
                      loadingLabel="Working"
                      leadingIcon={<Link2 aria-hidden="true" className="h-4 w-4" />}
                      onClick={() => {
                        void renew(invitation.id);
                      }}
                    >
                      New link
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busyId === invitation.id}
                      leadingIcon={<XCircle aria-hidden="true" className="h-4 w-4" />}
                      onClick={() => {
                        void revoke(invitation.id);
                      }}
                    >
                      Withdraw
                    </Button>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">No actions</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
