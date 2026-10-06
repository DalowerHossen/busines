// src/components/team/team-members-table.tsx
// Everybody who already has an account in this business, what they may do,
// and the actions an owner can take on each of them.

'use client';

import { MoreHorizontal, ShieldCheck, ShieldOff, SlidersHorizontal, UserMinus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { PermissionMatrix } from '@/components/team/permission-matrix';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { notify } from '@/components/ui/toaster';
import type { PermissionMap } from '@/config/permissions';
import { RESOURCE_DEFINITIONS } from '@/config/permissions';
import { setMemberStatus } from '@/features/team/actions/set-member-status';
import { updateMemberAccess } from '@/features/team/actions/update-member-access';
import type { TeamMember } from '@/features/team/types';
import { formatDate } from '@/lib/dates';

export interface TeamMembersTableProps {
  /** The people with an account in this business. */
  members: readonly TeamMember[];
  /** Identifier of the signed in account. */
  currentUserId: string;
  /** False when the signed in account may only read. */
  canManage: boolean;
}

const ROLE_LABELS: Readonly<Record<string, string>> = {
  owner: 'Owner',
  staff: 'Staff',
  accountant: 'Accountant',
  super_admin: 'Platform administrator',
  reseller: 'Reseller',
  affiliate: 'Affiliate',
};

/**
 * Describes a permission map in a few words.
 *
 * @param permissions The permissions held by one member.
 * @returns A readable summary.
 */
function describeAccess(permissions: PermissionMap): string {
  const resources = Object.keys(permissions);

  if (resources.length === 0) {
    return 'No areas yet';
  }

  const labels = resources
    .slice(0, 3)
    .map(
      (resource) =>
        RESOURCE_DEFINITIONS[resource as keyof typeof RESOURCE_DEFINITIONS]?.label ?? resource
    );

  return resources.length > 3 ? `${labels.join(', ')} and more` : labels.join(', ');
}

/**
 * Renders the list of team members.
 *
 * @param props The members and what the viewer may do with them.
 * @returns The rendered table.
 */
export function TeamMembersTable({ members, currentUserId, canManage }: TeamMembersTableProps) {
  const router = useRouter();
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [removing, setRemoving] = useState<TeamMember | null>(null);
  const [permissions, setPermissions] = useState<PermissionMap>({});
  const [jobTitle, setJobTitle] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  /**
   * Opens the access dialog for one member.
   *
   * @param member Member to edit.
   * @returns Nothing.
   */
  function openEditor(member: TeamMember): void {
    setEditing(member);
    setPermissions(member.permissions);
    setJobTitle(member.jobTitle ?? '');
    setFormError(null);
  }

  /**
   * Saves the access of the member being edited.
   *
   * @returns Nothing.
   */
  async function saveAccess(): Promise<void> {
    if (!editing) {
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    const result = await updateMemberAccess({ memberId: editing.id, jobTitle, permissions });
    setIsSubmitting(false);

    if (!result.success) {
      setFormError(result.error);
      return;
    }

    notify.success('Access saved.');
    setEditing(null);
    router.refresh();
  }

  /**
   * Suspends, reinstates or removes a member.
   *
   * @param member Member to change.
   * @param action What to do with the account.
   * @returns Nothing.
   */
  async function changeStatus(
    member: TeamMember,
    action: 'suspend' | 'reactivate' | 'remove'
  ): Promise<void> {
    setIsSubmitting(true);
    setFormError(null);

    const result = await setMemberStatus({ memberId: member.id, action, reason });
    setIsSubmitting(false);

    if (!result.success) {
      setFormError(result.error);
      notify.error(result.error);
      return;
    }

    const messages = {
      suspend: 'That account can no longer sign in.',
      reactivate: 'That account can sign in again.',
      remove: 'That person no longer has access to this business.',
    } as const;

    notify.success(messages[action]);
    setRemoving(null);
    setReason('');
    router.refresh();
  }

  if (members.length === 0) {
    return (
      <EmptyState
        title="Nobody else works here yet"
        description="Invite a colleague or your accountant, and decide exactly what they may do."
      />
    );
  }

  return (
    <>
      <Table caption="People with an account in this business">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Access</TableHead>
            <TableHead>Last signed in</TableHead>
            <TableHead>
              <span className="visually-hidden">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => (
            <TableRow key={member.id}>
              <TableCell>
                <span className="block font-medium text-foreground">{member.fullName}</span>
                <span className="block text-sm text-muted-foreground">{member.email}</span>
                {member.jobTitle ? (
                  <span className="block text-sm text-muted-foreground">{member.jobTitle}</span>
                ) : null}
              </TableCell>
              <TableCell>
                <Badge tone={member.role === 'owner' ? 'brand' : 'neutral'}>
                  {ROLE_LABELS[member.role] ?? member.role}
                </Badge>
              </TableCell>
              <TableCell>
                <StatusBadge kind="user" status={member.status} />
                {member.twoFactorEnabled ? (
                  <span className="mt-1 block text-sm text-success">Two factor on</span>
                ) : (
                  <span className="mt-1 block text-sm text-muted-foreground">Two factor off</span>
                )}
              </TableCell>
              <TableCell>
                {member.role === 'owner' ? 'Everything' : describeAccess(member.permissions)}
              </TableCell>
              <TableCell>
                {member.lastLoginAt ? formatDate(member.lastLoginAt) : 'Not yet'}
              </TableCell>
              <TableCell>
                {canManage && member.role !== 'owner' && member.id !== currentUserId ? (
                  <DropdownMenu
                    triggerLabel={`Actions for ${member.fullName}`}
                    trigger={
                      <span className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-md border border-border px-3">
                        <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
                      </span>
                    }
                    items={[
                      {
                        key: 'access',
                        label: 'Change access',
                        icon: SlidersHorizontal,
                        onSelect: () => {
                          openEditor(member);
                        },
                      },
                      member.status === 'suspended'
                        ? {
                            key: 'reactivate',
                            label: 'Let them sign in again',
                            icon: ShieldCheck,
                            onSelect: () => {
                              void changeStatus(member, 'reactivate');
                            },
                          }
                        : {
                            key: 'suspend',
                            label: 'Suspend access',
                            icon: ShieldOff,
                            onSelect: () => {
                              void changeStatus(member, 'suspend');
                            },
                          },
                      {
                        key: 'remove',
                        label: 'Remove from the business',
                        icon: UserMinus,
                        isDestructive: true,
                        onSelect: () => {
                          setRemoving(member);
                          setReason('');
                          setFormError(null);
                        },
                      },
                    ]}
                  />
                ) : (
                  <span className="text-sm text-muted-foreground">No actions</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Modal
        isOpen={editing !== null}
        onClose={() => {
          setEditing(null);
        }}
        title={editing ? `Access for ${editing.fullName}` : 'Access'}
        description="Tick only what this person needs. You can change it at any time."
        size="lg"
        footer={
          <div className="flex flex-wrap justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              disabled={isSubmitting}
              onClick={() => {
                setEditing(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              isLoading={isSubmitting}
              loadingLabel="Saving"
              onClick={() => {
                void saveAccess();
              }}
            >
              Save access
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          {formError ? (
            <Alert tone="danger" title="The access was not saved">
              {formError}
            </Alert>
          ) : null}

          <FormField id="member-title" label="Job title">
            <Input
              {...fieldAccessibilityProps('member-title', false, false)}
              value={jobTitle}
              disabled={isSubmitting}
              onChange={(event) => {
                setJobTitle(event.target.value);
              }}
            />
          </FormField>

          <PermissionMatrix
            idPrefix="member"
            value={permissions}
            onChange={setPermissions}
            isDisabled={isSubmitting}
          />
        </div>
      </Modal>

      <Modal
        isOpen={removing !== null}
        onClose={() => {
          setRemoving(null);
        }}
        title="Remove this person from the business"
        description="They lose access immediately. Everything they did stays in your records."
        footer={
          <div className="flex flex-wrap justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              disabled={isSubmitting}
              onClick={() => {
                setRemoving(null);
              }}
            >
              Keep them
            </Button>
            <Button
              type="button"
              variant="destructive"
              isLoading={isSubmitting}
              loadingLabel="Removing"
              onClick={() => {
                if (removing) {
                  void changeStatus(removing, 'remove');
                }
              }}
            >
              Remove access
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {formError ? (
            <Alert tone="danger" title="That did not work">
              {formError}
            </Alert>
          ) : null}

          <FormField
            id="remove-reason"
            label="Why are they leaving?"
            hint="Kept in the audit trail."
          >
            <Input
              {...fieldAccessibilityProps('remove-reason', true, false)}
              value={reason}
              disabled={isSubmitting}
              onChange={(event) => {
                setReason(event.target.value);
              }}
            />
          </FormField>
        </div>
      </Modal>
    </>
  );
}
