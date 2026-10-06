// src/components/loyalty/review-board.tsx
// What clients were asked, what they said, and which answers have been
// turned into quotes. Consent is the hinge: nothing is published without it
// and withdrawing it takes the quote straight back down.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/components/ui/toaster';
import { approveTestimonial } from '@/features/loyalty/actions/approve-testimonial';
import { saveTestimonial } from '@/features/loyalty/actions/save-testimonial';
import type { ReviewRequestRecord, TestimonialRecord } from '@/features/loyalty/types';
import { formatDate } from '@/lib/dates';
import { humanise } from '@/lib/format';

export interface ReviewBoardProps {
  /** The invitations sent and the answers that came back. */
  requests: readonly ReviewRequestRecord[];
  /** The quotes on file. */
  testimonials: readonly TestimonialRecord[];
  /** True when the viewer may publish. */
  canManage: boolean;
}

interface QuoteForm {
  testimonialId: string | null;
  reviewRequestId: string | null;
  authorName: string;
  authorTitle: string;
  authorCompany: string;
  quote: string;
  rating: string;
  consentGiven: boolean;
  displaySurface: string;
  isFeatured: boolean;
  displayOrder: string;
}

const SURFACE_OPTIONS = [
  { value: 'home', label: 'Home page' },
  { value: 'pricing', label: 'Pricing page' },
  { value: 'features', label: 'Features page' },
  { value: 'checkout', label: 'Checkout' },
  { value: 'landing', label: 'Landing pages' },
];

const EMPTY_QUOTE: QuoteForm = {
  testimonialId: null,
  reviewRequestId: null,
  authorName: '',
  authorTitle: '',
  authorCompany: '',
  quote: '',
  rating: '5',
  consentGiven: false,
  displaySurface: 'home',
  isFeatured: false,
  displayOrder: '100',
};

/**
 * Renders the review board.
 *
 * @param props The invitations, the quotes and what the viewer may do.
 * @returns The rendered board.
 */
export function ReviewBoard({ requests, testimonials, canManage }: ReviewBoardProps) {
  const router = useRouter();
  const [form, setForm] = useState<QuoteForm>(EMPTY_QUOTE);
  const [isSaving, setIsSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, readonly string[]>>({});

  /**
   * Changes one field of the quote form.
   *
   * @param key Field being changed.
   * @param value New value.
   * @returns Nothing.
   */
  function onChange(key: keyof QuoteForm, value: string | boolean): void {
    setForm((current) => ({ ...current, [key]: value }));
  }

  /**
   * Starts a quote from an answer a client gave.
   *
   * @param request The answered invitation.
   * @returns Nothing.
   */
  function onDraftFrom(request: ReviewRequestRecord): void {
    setFailure(null);
    setFieldErrors({});
    setForm({
      ...EMPTY_QUOTE,
      reviewRequestId: request.requestId,
      authorName: request.clientName ?? request.emailAddress,
      quote: request.comment ?? '',
      rating: request.rating === null ? '5' : String(request.rating),
    });
  }

  /**
   * Loads an existing quote into the form.
   *
   * @param testimonial The quote being changed.
   * @returns Nothing.
   */
  function onEdit(testimonial: TestimonialRecord): void {
    setFailure(null);
    setFieldErrors({});
    setForm({
      testimonialId: testimonial.testimonialId,
      reviewRequestId: testimonial.reviewRequestId,
      authorName: testimonial.authorName,
      authorTitle: testimonial.authorTitle ?? '',
      authorCompany: testimonial.authorCompany ?? '',
      quote: testimonial.quote,
      rating: testimonial.rating === null ? '5' : String(testimonial.rating),
      consentGiven: testimonial.consentGiven,
      displaySurface: testimonial.displaySurface,
      isFeatured: testimonial.isFeatured,
      displayOrder: String(testimonial.displayOrder),
    });
  }

  /**
   * Saves the quote in the form.
   *
   * @param event The submitted form.
   * @returns Nothing.
   */
  async function onSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSaving(true);
    setFailure(null);
    setFieldErrors({});

    const result = await saveTestimonial({
      testimonialId: form.testimonialId ?? undefined,
      reviewRequestId: form.reviewRequestId ?? undefined,
      authorName: form.authorName,
      authorTitle: form.authorTitle.trim() === '' ? undefined : form.authorTitle.trim(),
      authorCompany: form.authorCompany.trim() === '' ? undefined : form.authorCompany.trim(),
      quote: form.quote,
      rating: form.rating.trim() === '' ? undefined : form.rating,
      consentGiven: form.consentGiven,
      displaySurface: form.displaySurface,
      isFeatured: form.isFeatured,
      displayOrder: form.displayOrder,
    });

    setIsSaving(false);

    if (!result.success) {
      setFailure(result.error);
      setFieldErrors(result.fieldErrors ?? {});

      return;
    }

    notify.success('That quote is saved.');
    setForm(EMPTY_QUOTE);
    router.refresh();
  }

  /**
   * Publishes one quote.
   *
   * @param testimonialId Quote being published.
   * @returns Nothing.
   */
  async function onPublish(testimonialId: string): Promise<void> {
    const result = await approveTestimonial({ testimonialId });

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success('That quote is on the site.');
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>What clients were asked</CardTitle>
          <CardDescription>
            Nobody is invited before they have paid, and nobody is invited twice about the same
            piece of work.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No invitations yet. Open any paid invoice and ask the client what they thought.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>About</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead isNumeric>Rating</TableHead>
                  <TableHead>What they said</TableHead>
                  <TableHead>Asked</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.requestId}>
                    <TableCell>{request.clientName ?? request.emailAddress}</TableCell>
                    <TableCell>{humanise(request.subjectType)}</TableCell>
                    <TableCell>
                      <Badge tone={request.status === 'responded' ? 'success' : 'neutral'}>
                        {humanise(request.status)}
                      </Badge>
                    </TableCell>
                    <TableCell isNumeric>
                      {request.rating === null ? '—' : `${String(request.rating)} of 5`}
                    </TableCell>
                    <TableCell>
                      {request.comment === null ? (
                        '—'
                      ) : (
                        <span className="flex flex-col gap-1">
                          <span>{request.comment}</span>
                          {canManage && !request.hasTestimonial ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => onDraftFrom(request)}
                            >
                              Keep this as a quote
                            </Button>
                          ) : null}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(request.requestedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quotes on file</CardTitle>
          <CardDescription>
            A quote only appears on the site once the person who said it has agreed to it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {testimonials.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing has been kept as a quote yet.</p>
          ) : (
            <ul className="space-y-3">
              {testimonials.map((testimonial) => (
                <li
                  key={testimonial.testimonialId}
                  className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{testimonial.authorName}</p>
                      <Badge tone={testimonial.isApproved ? 'success' : 'neutral'}>
                        {testimonial.isApproved ? 'On the site' : 'Not published'}
                      </Badge>
                      {testimonial.consentGiven ? null : (
                        <Badge tone="warning">Consent not recorded</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{testimonial.quote}</p>
                    <p className="text-sm text-muted-foreground">
                      {`Shown on the ${humanise(testimonial.displaySurface)} page.`}
                    </p>
                  </div>

                  {canManage ? (
                    <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(testimonial)}
                      >
                        Change this quote
                      </Button>
                      {testimonial.isApproved || !testimonial.consentGiven ? null : (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => void onPublish(testimonial.testimonialId)}
                        >
                          Put it on the site
                        </Button>
                      )}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {canManage ? (
            <form
              className="space-y-4 border-t border-border pt-4"
              onSubmit={(event) => void onSubmit(event)}
              noValidate
            >
              {failure === null ? null : (
                <Alert tone="danger" title="That quote was not saved">
                  {failure}
                </Alert>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  id="quote-author"
                  label="Who said it"
                  isRequired
                  errors={fieldErrors.authorName}
                >
                  <Input
                    id="quote-author"
                    value={form.authorName}
                    onChange={(event) => onChange('authorName', event.target.value)}
                  />
                </FormField>

                <FormField id="quote-title" label="Their role">
                  <Input
                    id="quote-title"
                    value={form.authorTitle}
                    placeholder="Operations lead"
                    onChange={(event) => onChange('authorTitle', event.target.value)}
                  />
                </FormField>

                <FormField id="quote-company" label="Their business">
                  <Input
                    id="quote-company"
                    value={form.authorCompany}
                    onChange={(event) => onChange('authorCompany', event.target.value)}
                  />
                </FormField>

                <FormField id="quote-rating" label="Rating out of five">
                  <Input
                    id="quote-rating"
                    type="number"
                    min={1}
                    max={5}
                    value={form.rating}
                    onChange={(event) => onChange('rating', event.target.value)}
                  />
                </FormField>

                <FormField id="quote-surface" label="Where it should appear">
                  <Select
                    id="quote-surface"
                    value={form.displaySurface}
                    options={SURFACE_OPTIONS}
                    onChange={(event) => onChange('displaySurface', event.target.value)}
                  />
                </FormField>

                <FormField id="quote-order" label="Where it sits in the order">
                  <Input
                    id="quote-order"
                    type="number"
                    min={0}
                    value={form.displayOrder}
                    onChange={(event) => onChange('displayOrder', event.target.value)}
                  />
                </FormField>
              </div>

              <FormField
                id="quote-text"
                label="The quote itself"
                isRequired
                errors={fieldErrors.quote}
                hint="Twenty characters or more, in the words the client used."
              >
                <Textarea
                  id="quote-text"
                  rows={3}
                  value={form.quote}
                  onChange={(event) => onChange('quote', event.target.value)}
                />
              </FormField>

              <Checkbox
                label="The client has agreed to this being shown publicly"
                description="Take this away and the quote comes off the site immediately."
                checked={form.consentGiven}
                onChange={(event) => onChange('consentGiven', event.target.checked)}
              />

              <Checkbox
                label="Feature this one ahead of the others"
                checked={form.isFeatured}
                onChange={(event) => onChange('isFeatured', event.target.checked)}
              />

              <div className="flex flex-wrap gap-3">
                <Button type="submit" isLoading={isSaving} loadingLabel="Saving">
                  {form.testimonialId === null ? 'Keep this quote' : 'Save the change'}
                </Button>
                {form.testimonialId === null && form.reviewRequestId === null ? null : (
                  <Button type="button" variant="ghost" onClick={() => setForm(EMPTY_QUOTE)}>
                    Start again
                  </Button>
                )}
              </div>
            </form>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
