// src/components/team/invite-member-dialog.tsx
// Inviting somebody to the business. When the invitation is stored the owner
// is given the one time link to pass on; it is shown once and never again.

'use client';

import { Copy, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { PermissionMatrix } from '@/components/team/permission-matrix';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/components/ui/toaster';
import { ACCOUNTANT_PERMISSIONS, DEFAULT_STAFF_PERMISSIONS } from '@/config/permissions';
import type { PermissionMap } from '@/config/permissions';
import { absoluteUrl } from '@/env/client';
import { inviteMember } from '@/features/team/actions/invite-member';
import { formatDate } from '@/lib/dates';

const ROLE_OPTIONS = [
  { value: 'staff', label: 'Staff — works in the business, with the access you choose' },
  { value: 'accountant', label: 'Accountant — reads the books and keeps the journal' },
];

/**
 * Renders the invite button and the dialog behind it.
 *
 * @returns The rendered control.
 */
export function InviteMemberDialog() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [role, setRole] = useState('staff');
  const [message, setMessage] = useState('');
  const [permissions, setPermissions] = useState<PermissionMap>(DEFAULT_STAFF_PERMISSIONS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [issuedLink, setIssuedLink] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  /**
   * Clears the dialog and closes it.
   *
   * @returns Nothing.
   */
  function close(): void {
    setIsOpen(false);
    setEmail('');
    setFullName('');
    setJobTitle('');
    setRole('staff');
    setMessage('');
    setPermissions(DEFAULT_STAFF_PERMISSIONS);
    setFormError(null);
    setFieldErrors({});
    setIssuedLink(null);
    setExpiresAt(null);
  }

  /**
   * Stores the invitation.
   *
   * @param event Submit event from the form.
   * @returns Nothing.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    const result = await inviteMember({
      email,
      fullName,
      jobTitle,
      role,
      message,
      permissions: role === 'accountant' ? ACCOUNTANT_PERMISSIONS : permissions,
    });

    setIsSubmitting(false);

    if (!result.success) {
      setFormError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }

    setIssuedLink(absoluteUrl(result.data.invitationPath));
    setExpiresAt(result.data.expiresAt);
    notify.success('Invitation created. Share the link with the person you invited.');
    router.refresh();
  }

  /**
   * Copies the invitation link to the clipboard.
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

  return (
    <>
      <Button
        type="button"
        leadingIcon={<UserPlus aria-hidden="true" className="h-4 w-4" />}
        onClick={() => {
          setIsOpen(true);
        }}
      >
        Invite somebody
      </Button>

      <Modal
        isOpen={isOpen}
        onClose={close}
        title={issuedLink ? 'Invitation ready' : 'Invite somebody to this business'}
        description={
          issuedLink
            ? 'This link is shown once. Send it to the person you invited.'
            : 'Choose what they may do before you send the invitation.'
        }
        size="lg"
      >
        {issuedLink ? (
          <div className="space-y-4">
            <Alert tone="success" title="The invitation is waiting to be accepted">
              The link works until {expiresAt ? formatDate(expiresAt) : 'it expires'}, and can be
              used once.
            </Alert>

            <p className="break-all rounded-md border border-border bg-surface-muted p-3 text-sm">
              {issuedLink}
            </p>

            <div className="flex flex-wrap justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                leadingIcon={<Copy aria-hidden="true" className="h-4 w-4" />}
                onClick={() => {
                  void copyLink();
                }}
              >
                Copy link
              </Button>
              <Button type="button" onClick={close}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form
            noValidate
            onSubmit={(event) => {
              void handleSubmit(event);
            }}
            className="space-y-5"
          >
            {formError ? (
              <Alert tone="danger" title="The invitation was not created">
                {formError}
              </Alert>
            ) : null}

            <div className="grid gap-5 sm:grid-cols-2">
              <FormField
                id="invite-name"
                label="Full name"
                isRequired
                errors={fieldErrors['fullName']}
              >
                <Input
                  {...fieldAccessibilityProps(
                    'invite-name',
                    false,
                    Boolean(fieldErrors['fullName'])
                  )}
                  value={fullName}
                  disabled={isSubmitting}
                  onChange={(event) => {
                    setFullName(event.target.value);
                  }}
                />
              </FormField>

              <FormField
                id="invite-email"
                label="Email address"
                isRequired
                errors={fieldErrors['email']}
              >
                <Input
                  {...fieldAccessibilityProps('invite-email', false, Boolean(fieldErrors['email']))}
                  type="email"
                  value={email}
                  disabled={isSubmitting}
                  onChange={(event) => {
                    setEmail(event.target.value);
                  }}
                />
              </FormField>

              <FormField id="invite-role" label="Role" errors={fieldErrors['role']}>
                <Select
                  id="invite-role"
                  options={ROLE_OPTIONS}
                  value={role}
                  disabled={isSubmitting}
                  onChange={(event) => {
                    setRole(event.target.value);
                  }}
                />
              </FormField>

              <FormField id="invite-title" label="Job title" errors={fieldErrors['jobTitle']}>
                <Input
                  {...fieldAccessibilityProps(
                    'invite-title',
                    false,
                    Boolean(fieldErrors['jobTitle'])
                  )}
                  value={jobTitle}
                  disabled={isSubmitting}
                  onChange={(event) => {
                    setJobTitle(event.target.value);
                  }}
                />
              </FormField>
            </div>

            <FormField
              id="invite-message"
              label="A line for the invitation"
              hint="Explain why you are inviting them."
              errors={fieldErrors['message']}
            >
              <Textarea
                {...fieldAccessibilityProps(
                  'invite-message',
                  true,
                  Boolean(fieldErrors['message'])
                )}
                rows={3}
                value={message}
                disabled={isSubmitting}
                onChange={(event) => {
                  setMessage(event.target.value);
                }}
              />
            </FormField>

            {role === 'accountant' ? (
              <Alert tone="info" title="An accountant gets a fixed level of access">
                They can read your books, export them and keep the journal. They can never send
                anything to a client or change your settings.
              </Alert>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Staff never send email to a client. Everything else is up to you.
                </p>
                <PermissionMatrix
                  idPrefix="invite"
                  value={permissions}
                  onChange={setPermissions}
                  isDisabled={isSubmitting}
                />
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-3">
              <Button type="button" variant="secondary" onClick={close} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isSubmitting} loadingLabel="Creating">
                Create invitation
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
