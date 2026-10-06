// src/components/messaging/send-document-panel.tsx
// Sending a document to a client from the document's own page. An owner
// sends it; a staff member prepares it and asks the owner to approve.

'use client';

import { Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/components/ui/toaster';
import { requestDocumentSend } from '@/features/messaging/actions/request-document-send';
import { sendDocument } from '@/features/messaging/actions/send-document';

export interface SendDocumentPanelProps {
  /** Which kind of document is being sent. */
  documentKind: 'invoice' | 'estimate';
  /** Identifier of the document. */
  documentId: string;
  /** Address the client is known by, when there is one. */
  clientEmail: string | null;
  /** Name the client is known by. */
  clientName: string | null;
  /** True when the signed in account is the owner. */
  isOwner: boolean;
}

const INVOICE_TEMPLATES = [
  { value: 'invoice_sent', label: 'Here is your invoice' },
  { value: 'invoice_reminder', label: 'A friendly reminder before the due date' },
  { value: 'invoice_overdue', label: 'This invoice is now overdue' },
];

const ESTIMATE_TEMPLATES = [{ value: 'estimate_sent', label: 'Here is your estimate' }];

/**
 * Renders the send panel on a document page.
 *
 * @param props The document and who is sending it.
 * @returns The rendered panel.
 */
export function SendDocumentPanel({
  documentKind,
  documentId,
  clientEmail,
  clientName,
  isOwner,
}: SendDocumentPanelProps) {
  const router = useRouter();
  const templates = documentKind === 'invoice' ? INVOICE_TEMPLATES : ESTIMATE_TEMPLATES;
  const [email, setEmail] = useState(clientEmail ?? '');
  const [templateKey, setTemplateKey] = useState(templates[0]?.value ?? 'invoice_sent');
  const [message, setMessage] = useState('');
  const [isWorking, setIsWorking] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [wasHandled, setWasHandled] = useState(false);

  /**
   * Sends the document, or asks the owner to send it.
   *
   * @param event Submit event from the form.
   * @returns Nothing.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsWorking(true);
    setFormError(null);
    setFieldErrors({});

    const payload = {
      documentKind,
      documentId,
      recipientEmail: email,
      recipientName: clientName ?? undefined,
      templateKey,
      customMessage: message,
    };

    const result = isOwner ? await sendDocument(payload) : await requestDocumentSend(payload);
    setIsWorking(false);

    if (!result.success) {
      setFormError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }

    setWasHandled(true);
    notify.success(
      isOwner
        ? 'On its way. You can follow it in the outbox.'
        : 'Sent to the owner for approval. They will see it in the outbox.'
    );
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isOwner ? 'Send to the client' : 'Ask the owner to send this'}</CardTitle>
        <CardDescription>
          {isOwner
            ? 'The client receives an email with a private link to this document.'
            : 'Only the owner writes to a client. Prepare the message here and they will approve it.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {wasHandled ? (
          <Alert tone="success" title={isOwner ? 'The document is on its way' : 'Request raised'}>
            {isOwner
              ? 'Follow delivery, opens and failures in the outbox.'
              : 'The owner can approve it from the outbox page.'}
          </Alert>
        ) : (
          <form
            noValidate
            onSubmit={(event) => {
              void handleSubmit(event);
            }}
            className="space-y-5"
          >
            {formError ? (
              <Alert tone="danger" title="That was not sent">
                {formError}
              </Alert>
            ) : null}

            <FormField
              id="send-email"
              label="Send to"
              isRequired
              errors={fieldErrors['recipientEmail']}
            >
              <Input
                {...fieldAccessibilityProps(
                  'send-email',
                  false,
                  Boolean(fieldErrors['recipientEmail'])
                )}
                type="email"
                value={email}
                disabled={isWorking}
                onChange={(event) => {
                  setEmail(event.target.value);
                }}
              />
            </FormField>

            <FormField id="send-template" label="What this email says">
              <Select
                id="send-template"
                options={templates}
                value={templateKey}
                disabled={isWorking}
                onChange={(event) => {
                  setTemplateKey(event.target.value);
                }}
              />
            </FormField>

            <FormField
              id="send-message"
              label="A line of your own"
              hint="Added to the message your client receives."
              errors={fieldErrors['customMessage']}
            >
              <Textarea
                {...fieldAccessibilityProps(
                  'send-message',
                  true,
                  Boolean(fieldErrors['customMessage'])
                )}
                rows={3}
                value={message}
                disabled={isWorking}
                onChange={(event) => {
                  setMessage(event.target.value);
                }}
              />
            </FormField>

            <Button
              type="submit"
              isLoading={isWorking}
              loadingLabel={isOwner ? 'Sending' : 'Requesting'}
              leadingIcon={<Send aria-hidden="true" className="h-4 w-4" />}
            >
              {isOwner ? 'Send to the client' : 'Ask the owner to send'}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
