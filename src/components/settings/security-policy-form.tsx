// src/components/settings/security-policy-form.tsx
// The rules the whole team is held to: how people sign in, how long a session
// lasts, how client links behave, and how much a staff member may approve on
// their own.

'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { notify } from '@/components/ui/toaster';
import { updateSecurityPolicy } from '@/features/settings/actions/update-security-policy';
import type { SecurityPolicySettings } from '@/features/settings/types';

export interface SecurityPolicyFormProps {
  /** The rules as they are stored today. */
  security: SecurityPolicySettings;
  /** Currency the staff limits are counted in. */
  currency: string;
  /** False when the signed in account may only read. */
  canEdit: boolean;
}

/**
 * Renders the security rules form.
 *
 * @param props The stored rules and whether they may be changed.
 * @returns The rendered form.
 */
export function SecurityPolicyForm({ security, currency, canEdit }: SecurityPolicyFormProps) {
  const router = useRouter();
  const [requireTwoFactor, setRequireTwoFactor] = useState(security.requireTwoFactor);
  const [requireTwoFactorForOwner, setRequireTwoFactorForOwner] = useState(
    security.requireTwoFactorForOwner
  );
  const [requireEmailOtpForLinks, setRequireEmailOtpForLinks] = useState(
    security.requireEmailOtpForLinks
  );
  const [requireApprovalForRefunds, setRequireApprovalForRefunds] = useState(
    security.requireApprovalForRefunds
  );
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(
    String(security.sessionTimeoutMinutes)
  );
  const [passwordMinLength, setPasswordMinLength] = useState(String(security.passwordMinLength));
  const [documentLinkTtlDays, setDocumentLinkTtlDays] = useState(
    String(security.documentLinkTtlDays)
  );
  const [staffSingleActionCap, setStaffSingleActionCap] = useState(
    security.staffSingleActionCap ?? ''
  );
  const [staffDailyCap, setStaffDailyCap] = useState(security.staffDailyCap ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  /**
   * Saves the rules.
   *
   * @param event Submit event from the form.
   * @returns Nothing.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    const result = await updateSecurityPolicy({
      requireTwoFactor,
      requireTwoFactorForOwner,
      sessionTimeoutMinutes,
      passwordMinLength,
      requireEmailOtpForLinks,
      documentLinkTtlDays,
      requireApprovalForRefunds,
      staffSingleActionCap,
      staffDailyCap,
    });

    setIsSubmitting(false);

    if (!result.success) {
      setFormError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }

    notify.success('Security rules saved. They apply from the next sign in.');
    router.refresh();
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
      className="space-y-6"
    >
      {canEdit ? null : (
        <Alert tone="info" title="You are looking at the rules you are held to">
          Only the owner of the business can change them.
        </Alert>
      )}

      {formError ? (
        <Alert tone="danger" title="The rules were not saved">
          {formError}
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Signing in</CardTitle>
          <CardDescription>
            Two factor authentication is the single most effective protection for an account that
            can move money.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Checkbox
            id="security-2fa-owner"
            label="Require two factor authentication for the owner"
            description="Strongly recommended, and kept on by default."
            checked={requireTwoFactorForOwner}
            disabled={isSubmitting || !canEdit}
            onChange={(event) => {
              setRequireTwoFactorForOwner(event.target.checked);
            }}
          />

          <Checkbox
            id="security-2fa-all"
            label="Require it for everybody in the business"
            description="Each person is asked to set it up the next time they sign in."
            checked={requireTwoFactor}
            disabled={isSubmitting || !canEdit}
            onChange={(event) => {
              setRequireTwoFactor(event.target.checked);
            }}
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              id="security-session"
              label="Sign people out after this many minutes"
              hint="Eight hours suits an office. Shorter suits shared machines."
              errors={fieldErrors['sessionTimeoutMinutes']}
            >
              <Input
                {...fieldAccessibilityProps(
                  'security-session',
                  true,
                  Boolean(fieldErrors['sessionTimeoutMinutes'])
                )}
                type="number"
                min={5}
                max={43200}
                value={sessionTimeoutMinutes}
                disabled={isSubmitting || !canEdit}
                onChange={(event) => {
                  setSessionTimeoutMinutes(event.target.value);
                }}
              />
            </FormField>

            <FormField
              id="security-password"
              label="Shortest password allowed"
              errors={fieldErrors['passwordMinLength']}
            >
              <Input
                {...fieldAccessibilityProps(
                  'security-password',
                  false,
                  Boolean(fieldErrors['passwordMinLength'])
                )}
                type="number"
                min={8}
                max={64}
                value={passwordMinLength}
                disabled={isSubmitting || !canEdit}
                onChange={(event) => {
                  setPasswordMinLength(event.target.value);
                }}
              />
            </FormField>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Links you send to clients</CardTitle>
          <CardDescription>
            A link opens the invoice straight away by default, because every extra step costs you
            payments. Ask for a code only if your clients expect it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Checkbox
            id="security-otp"
            label="Ask for an emailed code before an invoice can be viewed"
            description="Off by default. Turning it on slows payment but adds a check."
            checked={requireEmailOtpForLinks}
            disabled={isSubmitting || !canEdit}
            onChange={(event) => {
              setRequireEmailOtpForLinks(event.target.checked);
            }}
          />

          <FormField
            id="security-link-ttl"
            label="A client link stops working after this many days"
            errors={fieldErrors['documentLinkTtlDays']}
          >
            <Input
              {...fieldAccessibilityProps(
                'security-link-ttl',
                false,
                Boolean(fieldErrors['documentLinkTtlDays'])
              )}
              type="number"
              min={1}
              max={365}
              value={documentLinkTtlDays}
              disabled={isSubmitting || !canEdit}
              onChange={(event) => {
                setDocumentLinkTtlDays(event.target.value);
              }}
            />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What staff may do alone</CardTitle>
          <CardDescription>
            Limits are counted in {currency}. Leave them empty for no limit.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Checkbox
            id="security-refunds"
            label="A refund always needs the owner to approve it"
            checked={requireApprovalForRefunds}
            disabled={isSubmitting || !canEdit}
            onChange={(event) => {
              setRequireApprovalForRefunds(event.target.checked);
            }}
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              id="security-single-cap"
              label="Most a staff member may approve at once"
              errors={fieldErrors['staffSingleActionCap']}
            >
              <Input
                {...fieldAccessibilityProps(
                  'security-single-cap',
                  false,
                  Boolean(fieldErrors['staffSingleActionCap'])
                )}
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={staffSingleActionCap}
                disabled={isSubmitting || !canEdit}
                onChange={(event) => {
                  setStaffSingleActionCap(event.target.value);
                }}
              />
            </FormField>

            <FormField
              id="security-daily-cap"
              label="Most a staff member may approve in a day"
              errors={fieldErrors['staffDailyCap']}
            >
              <Input
                {...fieldAccessibilityProps(
                  'security-daily-cap',
                  false,
                  Boolean(fieldErrors['staffDailyCap'])
                )}
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={staffDailyCap}
                disabled={isSubmitting || !canEdit}
                onChange={(event) => {
                  setStaffDailyCap(event.target.value);
                }}
              />
            </FormField>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" isLoading={isSubmitting} loadingLabel="Saving" disabled={!canEdit}>
          Save security rules
        </Button>
      </div>
    </form>
  );
}
