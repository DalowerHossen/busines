// src/components/marketing/contact-form.tsx
// The form on the contact page. It shows what it is doing at every moment:
// idle, sending, sent, or failed with the reason against the field at fault.

'use client';

import { CheckCircle2, Send } from 'lucide-react';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/components/ui/toaster';
import { ROUTES } from '@/config/app';
import { BRAND } from '@/config/brand';
import { submitContactMessage } from '@/features/marketing/actions/submit-contact-message';
import { CONTACT_TOPICS } from '@/features/marketing/validation/contact';

type FormStatus = 'idle' | 'sending' | 'sent';

interface FormValues {
  fullName: string;
  email: string;
  companyName: string;
  topic: string;
  message: string;
  acceptsPrivacyPolicy: boolean;
  website: string;
}

const EMPTY_VALUES: FormValues = {
  fullName: '',
  email: '',
  companyName: '',
  topic: 'sales',
  message: '',
  acceptsPrivacyPolicy: false,
  website: '',
};

/**
 * Renders the contact form.
 *
 * @returns The rendered form.
 */
export function ContactForm() {
  const [values, setValues] = useState<FormValues>(EMPTY_VALUES);
  const [status, setStatus] = useState<FormStatus>('idle');
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [reference, setReference] = useState<string | null>(null);

  /**
   * Updates one field and clears the error it was showing.
   *
   * @param field Field being changed.
   * @param value New value.
   * @returns Nothing.
   */
  function change<Field extends keyof FormValues>(field: Field, value: FormValues[Field]): void {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!(field in current)) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  /**
   * Sends the message and reports what happened.
   *
   * @param event Submit event from the form.
   * @returns Nothing.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setStatus('sending');
    setFormError(null);
    setFieldErrors({});

    const result = await submitContactMessage({
      fullName: values.fullName,
      email: values.email,
      companyName: values.companyName,
      topic: values.topic,
      message: values.message,
      acceptsPrivacyPolicy: values.acceptsPrivacyPolicy,
      website: values.website,
    });

    if (result.success) {
      setStatus('sent');
      setReference(result.data.reference);
      setValues(EMPTY_VALUES);
      notify.success(
        'Your message has been sent',
        'We answer every message within one working day.'
      );
      return;
    }

    setStatus('idle');
    setFormError(result.error);
    setFieldErrors(result.fieldErrors ?? {});
    notify.error('The message was not sent', result.error);
  }

  if (status === 'sent') {
    return (
      <div className="rounded-lg border border-border bg-surface p-6 shadow-xs">
        <div className="flex items-start gap-3">
          <CheckCircle2 aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-success" />
          <div className="space-y-2">
            <h3 className="text-base font-semibold text-foreground">Thank you, that is with us</h3>
            <p className="text-sm text-muted-foreground">
              We answer every message within one working day, and sooner during office hours. Your
              reference is <span className="tabular font-medium text-foreground">{reference}</span>.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setStatus('idle');
                setReference(null);
              }}
            >
              Send another message
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isSending = status === 'sending';

  return (
    <form
      noValidate
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
      className="space-y-5 rounded-lg border border-border bg-surface p-6 shadow-xs"
    >
      {formError ? (
        <Alert tone="danger" title="The message was not sent">
          {formError}
        </Alert>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="contact-name" label="Your name" isRequired errors={fieldErrors['fullName']}>
          <Input
            {...fieldAccessibilityProps('contact-name', false, Boolean(fieldErrors['fullName']))}
            name="fullName"
            autoComplete="name"
            value={values.fullName}
            disabled={isSending}
            onChange={(event) => {
              change('fullName', event.target.value);
            }}
          />
        </FormField>

        <FormField
          id="contact-email"
          label="Email address"
          isRequired
          errors={fieldErrors['email']}
        >
          <Input
            {...fieldAccessibilityProps('contact-email', false, Boolean(fieldErrors['email']))}
            name="email"
            type="email"
            autoComplete="email"
            value={values.email}
            disabled={isSending}
            onChange={(event) => {
              change('email', event.target.value);
            }}
          />
        </FormField>

        <FormField
          id="contact-company"
          label="Company"
          hint="Optional, but it helps us answer properly."
          errors={fieldErrors['companyName']}
        >
          <Input
            {...fieldAccessibilityProps(
              'contact-company',
              true,
              Boolean(fieldErrors['companyName'])
            )}
            name="companyName"
            autoComplete="organization"
            value={values.companyName}
            disabled={isSending}
            onChange={(event) => {
              change('companyName', event.target.value);
            }}
          />
        </FormField>

        <FormField
          id="contact-topic"
          label="What is this about"
          isRequired
          errors={fieldErrors['topic']}
        >
          <Select
            {...fieldAccessibilityProps('contact-topic', false, Boolean(fieldErrors['topic']))}
            name="topic"
            options={CONTACT_TOPICS.map((topic) => ({ value: topic.value, label: topic.label }))}
            isInvalid={Boolean(fieldErrors['topic'])}
            value={values.topic}
            disabled={isSending}
            onChange={(event) => {
              change('topic', event.target.value);
            }}
          />
        </FormField>
      </div>

      <FormField
        id="contact-message"
        label="Message"
        isRequired
        hint="Tell us what you are trying to do and we will tell you whether we can help."
        errors={fieldErrors['message']}
      >
        <Textarea
          {...fieldAccessibilityProps('contact-message', true, Boolean(fieldErrors['message']))}
          name="message"
          rows={6}
          value={values.message}
          disabled={isSending}
          onChange={(event) => {
            change('message', event.target.value);
          }}
        />
      </FormField>

      <div aria-hidden="true" className="visually-hidden">
        <label htmlFor="contact-website">Leave this field empty</label>
        <input
          id="contact-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={values.website}
          onChange={(event) => {
            change('website', event.target.value);
          }}
        />
      </div>

      <div className="space-y-1.5">
        <Checkbox
          id="contact-consent"
          name="acceptsPrivacyPolicy"
          checked={values.acceptsPrivacyPolicy}
          disabled={isSending}
          aria-invalid={Boolean(fieldErrors['acceptsPrivacyPolicy']) || undefined}
          onChange={(event) => {
            change('acceptsPrivacyPolicy', event.target.checked);
          }}
          label={
            <span>
              I have read the{' '}
              <Link
                href={ROUTES.privacyPolicy}
                className="text-primary underline-offset-4 hover:underline"
              >
                privacy policy
              </Link>{' '}
              and agree to {BRAND.name} using these details to answer me.
            </span>
          }
        />
        {fieldErrors['acceptsPrivacyPolicy'] ? (
          <p role="alert" className="text-sm font-medium text-destructive">
            {fieldErrors['acceptsPrivacyPolicy'].join(' ')}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="submit"
          isLoading={isSending}
          loadingLabel="Sending"
          leadingIcon={<Send className="h-4 w-4" />}
        >
          Send message
        </Button>
        <p className="text-sm text-muted-foreground">
          Or write straight to{' '}
          <a
            href={`mailto:${BRAND.supportEmail}`}
            className="text-primary underline-offset-4 hover:underline"
          >
            {BRAND.supportEmail}
          </a>
          .
        </p>
      </div>
    </form>
  );
}
