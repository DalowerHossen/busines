// src/components/recurring/schedule-form.tsx
// Setting up recurring billing: which draft is copied, how often, when it
// starts and when it should stop.

'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/components/ui/toaster';
import { ROUTES } from '@/config/app';
import { createSchedule } from '@/features/recurring/actions/create-schedule';
import { updateSchedule } from '@/features/recurring/actions/update-schedule';
import { FREQUENCY_LABELS, describeCadence } from '@/features/recurring/status';
import type { ScheduleDetail, ScheduleFormData } from '@/features/recurring/types';
import { todayIso } from '@/lib/dates';
import { formatMoney } from '@/lib/format';
import { RECURRENCE_FREQUENCIES } from '@/types/enums';

export interface ScheduleFormProps {
  /** Schedule being edited, or undefined when setting up a new one. */
  schedule?: ScheduleDetail;
  /** The draft invoices that can act as a template. */
  formData: ScheduleFormData;
}

const FREQUENCY_OPTIONS = RECURRENCE_FREQUENCIES.map((value) => ({
  value,
  label: FREQUENCY_LABELS[value],
}));

/**
 * Renders the recurring schedule form.
 *
 * @param props The schedule being edited and the templates on offer.
 * @returns The rendered form.
 */
export function ScheduleForm({ schedule, formData }: ScheduleFormProps) {
  const router = useRouter();
  const isEditing = schedule !== undefined;

  const [name, setName] = useState(schedule?.name ?? '');
  const [templateInvoiceId, setTemplateInvoiceId] = useState(
    schedule?.templateInvoiceId ?? formData.templates[0]?.id ?? ''
  );
  const [frequency, setFrequency] = useState<string>(schedule?.frequency ?? 'monthly');
  const [intervalCount, setIntervalCount] = useState(String(schedule?.intervalCount ?? 1));
  const [customIntervalDays, setCustomIntervalDays] = useState(
    schedule?.customIntervalDays === null || schedule?.customIntervalDays === undefined
      ? ''
      : String(schedule.customIntervalDays)
  );
  const [startDate, setStartDate] = useState(schedule?.startDate ?? todayIso());
  const [endDate, setEndDate] = useState(schedule?.endDate ?? '');
  const [maxOccurrences, setMaxOccurrences] = useState(
    schedule?.maxOccurrences === null || schedule?.maxOccurrences === undefined
      ? ''
      : String(schedule.maxOccurrences)
  );
  const [paymentTermsDays, setPaymentTermsDays] = useState(
    String(schedule?.paymentTermsDays ?? 30)
  );
  const [daysBeforeToCreate, setDaysBeforeToCreate] = useState(
    String(schedule?.daysBeforeToCreate ?? 0)
  );
  const [autoIssue, setAutoIssue] = useState(schedule?.autoIssue ?? true);
  const [autoSend, setAutoSend] = useState(schedule?.autoSend ?? false);
  const [notes, setNotes] = useState(schedule?.notes ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const templateOptions = formData.templates.map((template) => ({
    value: template.id,
    label: template.label,
  }));

  const chosenTemplate = formData.templates.find((entry) => entry.id === templateInvoiceId);

  const cadence = useMemo(() => {
    const parsedInterval = Number.parseInt(intervalCount, 10);
    const parsedCustom = Number.parseInt(customIntervalDays, 10);

    return describeCadence(
      RECURRENCE_FREQUENCIES.includes(frequency as (typeof RECURRENCE_FREQUENCIES)[number])
        ? (frequency as (typeof RECURRENCE_FREQUENCIES)[number])
        : 'monthly',
      Number.isFinite(parsedInterval) ? parsedInterval : 1,
      Number.isFinite(parsedCustom) ? parsedCustom : null
    );
  }, [frequency, intervalCount, customIntervalDays]);

  /**
   * Saves the schedule and opens it.
   *
   * @param event Submit event from the form.
   * @returns Nothing.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    const payload = {
      name,
      templateInvoiceId,
      frequency: frequency as (typeof RECURRENCE_FREQUENCIES)[number],
      intervalCount,
      customIntervalDays,
      startDate,
      endDate,
      maxOccurrences,
      paymentTermsDays,
      daysBeforeToCreate,
      autoIssue,
      autoSend,
      notes,
    };

    const result = isEditing
      ? await updateSchedule({ ...payload, scheduleId: schedule.id })
      : await createSchedule(payload);

    if (!result.success) {
      setIsSubmitting(false);
      setFormError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }

    notify.success(isEditing ? 'Schedule saved.' : 'Recurring schedule created.');
    router.push(`${ROUTES.subscriptions}/${result.data.scheduleId}`);
    router.refresh();
  }

  if (formData.templates.length === 0) {
    return (
      <Alert tone="warning" title="Write the first invoice before you automate it">
        A schedule copies a draft invoice every time it runs. Create the invoice you want to send
        every period, leave it as a draft, and it will appear here as a template.
      </Alert>
    );
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
      className="space-y-6"
    >
      {formError ? (
        <Alert tone="danger" title="The schedule was not saved">
          {formError}
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>What is billed</CardTitle>
          <CardDescription>
            The draft you pick stays a draft for good. Each run copies it into a fresh invoice.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <FormField id="schedule-name" label="Name" isRequired errors={fieldErrors['name']}>
            <Input
              {...fieldAccessibilityProps('schedule-name', false, Boolean(fieldErrors['name']))}
              name="name"
              value={name}
              disabled={isSubmitting}
              onChange={(event) => {
                setName(event.target.value);
              }}
            />
          </FormField>

          <FormField
            id="schedule-template"
            label="Template invoice"
            isRequired
            errors={fieldErrors['templateInvoiceId']}
          >
            <Select
              id="schedule-template"
              name="templateInvoiceId"
              options={templateOptions}
              value={templateInvoiceId}
              disabled={isSubmitting}
              onChange={(event) => {
                setTemplateInvoiceId(event.target.value);
              }}
            />
          </FormField>

          {chosenTemplate === undefined ? null : (
            <p className="text-sm text-muted-foreground sm:col-span-2">
              Each run bills {chosenTemplate.clientName}{' '}
              {formatMoney(chosenTemplate.totalAmount, chosenTemplate.currency)},{' '}
              {cadence.toLowerCase()}.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How often</CardTitle>
          <CardDescription>
            A schedule stops on its end date or after a set number of invoices, whichever comes
            first.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <FormField id="schedule-frequency" label="Frequency" errors={fieldErrors['frequency']}>
            <Select
              id="schedule-frequency"
              name="frequency"
              options={FREQUENCY_OPTIONS}
              value={frequency}
              disabled={isSubmitting}
              onChange={(event) => {
                setFrequency(event.target.value);
              }}
            />
          </FormField>

          {frequency === 'custom' ? (
            <FormField
              id="schedule-custom-days"
              label="Days between invoices"
              isRequired
              errors={fieldErrors['customIntervalDays']}
            >
              <Input
                {...fieldAccessibilityProps(
                  'schedule-custom-days',
                  false,
                  Boolean(fieldErrors['customIntervalDays'])
                )}
                type="number"
                min={1}
                max={365}
                name="customIntervalDays"
                value={customIntervalDays}
                disabled={isSubmitting}
                onChange={(event) => {
                  setCustomIntervalDays(event.target.value);
                }}
              />
            </FormField>
          ) : (
            <FormField
              id="schedule-interval"
              label="Repeat every"
              hint="Leave at one for the plain rhythm, or raise it to skip periods."
              errors={fieldErrors['intervalCount']}
            >
              <Input
                {...fieldAccessibilityProps(
                  'schedule-interval',
                  true,
                  Boolean(fieldErrors['intervalCount'])
                )}
                type="number"
                min={1}
                max={52}
                name="intervalCount"
                value={intervalCount}
                disabled={isSubmitting}
                onChange={(event) => {
                  setIntervalCount(event.target.value);
                }}
              />
            </FormField>
          )}

          <FormField id="schedule-start" label="First invoice on" errors={fieldErrors['startDate']}>
            <Input
              {...fieldAccessibilityProps(
                'schedule-start',
                false,
                Boolean(fieldErrors['startDate'])
              )}
              type="date"
              name="startDate"
              value={startDate}
              disabled={isSubmitting}
              onChange={(event) => {
                setStartDate(event.target.value);
              }}
            />
          </FormField>

          <FormField
            id="schedule-end"
            label="Stop after this date"
            hint="Leave empty to keep billing until you stop it."
            errors={fieldErrors['endDate']}
          >
            <Input
              {...fieldAccessibilityProps('schedule-end', true, Boolean(fieldErrors['endDate']))}
              type="date"
              name="endDate"
              value={endDate}
              disabled={isSubmitting}
              onChange={(event) => {
                setEndDate(event.target.value);
              }}
            />
          </FormField>

          <FormField
            id="schedule-max"
            label="Number of invoices"
            hint="Leave empty for no limit."
            errors={fieldErrors['maxOccurrences']}
          >
            <Input
              {...fieldAccessibilityProps(
                'schedule-max',
                true,
                Boolean(fieldErrors['maxOccurrences'])
              )}
              type="number"
              min={1}
              max={1000}
              name="maxOccurrences"
              value={maxOccurrences}
              disabled={isSubmitting}
              onChange={(event) => {
                setMaxOccurrences(event.target.value);
              }}
            />
          </FormField>

          <FormField
            id="schedule-terms"
            label="Payment terms in days"
            errors={fieldErrors['paymentTermsDays']}
          >
            <Input
              {...fieldAccessibilityProps(
                'schedule-terms',
                false,
                Boolean(fieldErrors['paymentTermsDays'])
              )}
              type="number"
              min={0}
              max={365}
              name="paymentTermsDays"
              value={paymentTermsDays}
              disabled={isSubmitting}
              onChange={(event) => {
                setPaymentTermsDays(event.target.value);
              }}
            />
          </FormField>

          <FormField
            id="schedule-lead"
            label="Prepare this many days early"
            hint="Useful when somebody should check the invoice before the client sees it."
            errors={fieldErrors['daysBeforeToCreate']}
          >
            <Input
              {...fieldAccessibilityProps(
                'schedule-lead',
                true,
                Boolean(fieldErrors['daysBeforeToCreate'])
              )}
              type="number"
              min={0}
              max={30}
              name="daysBeforeToCreate"
              value={daysBeforeToCreate}
              disabled={isSubmitting}
              onChange={(event) => {
                setDaysBeforeToCreate(event.target.value);
              }}
            />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What happens on each run</CardTitle>
          <CardDescription>
            Sending remains an owner action, so leave the second switch off if drafts should be
            checked first.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Checkbox
            id="schedule-auto-issue"
            name="autoIssue"
            label="Issue the invoice automatically"
            description="The invoice is numbered and locked as soon as it is produced."
            checked={autoIssue}
            disabled={isSubmitting}
            onChange={(event) => {
              setAutoIssue(event.target.checked);
            }}
          />

          <Checkbox
            id="schedule-auto-send"
            name="autoSend"
            label="Email it to the client"
            description="Only an owner can turn this on, and only issued invoices are sent."
            checked={autoSend}
            disabled={isSubmitting || !autoIssue}
            onChange={(event) => {
              setAutoSend(event.target.checked);
            }}
          />

          <FormField id="schedule-notes" label="Internal notes" errors={fieldErrors['notes']}>
            <Textarea
              {...fieldAccessibilityProps('schedule-notes', false, Boolean(fieldErrors['notes']))}
              name="notes"
              rows={3}
              value={notes}
              disabled={isSubmitting}
              onChange={(event) => {
                setNotes(event.target.value);
              }}
            />
          </FormField>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="secondary"
          disabled={isSubmitting}
          onClick={() => {
            router.back();
          }}
        >
          Cancel
        </Button>
        <Button type="submit" isLoading={isSubmitting} loadingLabel="Saving">
          {isEditing ? 'Save schedule' : 'Create schedule'}
        </Button>
      </div>
    </form>
  );
}
