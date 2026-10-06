// src/features/messaging/actions/send-reminders.ts
// Chasing several unpaid invoices at once. Each client still receives their
// own message with their own link; the batch only saves the owner from
// pressing send a hundred times.

'use server';

import { revalidatePath } from 'next/cache';

import { sendDocument } from '@/features/messaging/actions/send-document';
import { sendRemindersSchema } from '@/features/messaging/validation/messaging';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { asRows, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface ReminderFailure {
  /** Number of the invoice that could not be chased. */
  invoiceNumber: string;
  /** What stopped it. */
  reason: string;
}

export interface SendRemindersResult {
  /** How many reminders were queued. */
  sentCount: number;
  /** The invoices that were skipped, with the reason for each. */
  failures: readonly ReminderFailure[];
}

export const sendReminders = createAction(
  sendRemindersSchema,
  async (input): Promise<SendRemindersResult> => {
    const { company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from('invoices')
      .select('id, invoice_number, balance_due, clients(display_name, email)')
      .eq('company_id', company.id)
      .in('id', input.invoiceIds)
      .is('deleted_at', null);

    if (error) {
      logger.error('Could not read the invoices being chased', error, { companyId: company.id });

      return { sentCount: 0, failures: [] };
    }

    const failures: ReminderFailure[] = [];
    let sentCount = 0;

    for (const row of asRows(data)) {
      const invoiceNumber = readString(row, 'invoice_number') ?? 'a draft invoice';
      const client = row['clients'];
      const clientRow =
        typeof client === 'object' && client !== null && !Array.isArray(client)
          ? (client as Record<string, unknown>)
          : {};
      const email = typeof clientRow['email'] === 'string' ? clientRow['email'] : null;
      const name = typeof clientRow['display_name'] === 'string' ? clientRow['display_name'] : null;

      if (!email) {
        failures.push({
          invoiceNumber,
          reason: 'This client has no email address on file.',
        });
        continue;
      }

      const result = await sendDocument({
        documentKind: 'invoice',
        documentId: readString(row, 'id') ?? '',
        recipientEmail: email,
        recipientName: name ?? undefined,
        templateKey: input.templateKey,
      });

      if (result.success) {
        sentCount += 1;
      } else {
        failures.push({ invoiceNumber, reason: result.error });
      }
    }

    await recordAuditEntry({
      action: 'send',
      entityType: 'invoice_batch',
      entityId: null,
      companyId: company.id,
      description: `${sentCount} reminder message(s) queued, ${failures.length} skipped.`,
    });

    revalidatePath('/dashboard/messages');
    revalidatePath('/dashboard/invoices');

    return { sentCount, failures };
  },
  { name: 'sendReminders' }
);
