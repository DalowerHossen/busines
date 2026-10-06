// src/features/settings/actions/update-invoice-defaults.ts
// Saves how documents are numbered, what they say by default, and how they
// look. New documents follow the new settings; issued ones do not change.

'use server';

import { revalidatePath } from 'next/cache';

import { invoiceDefaultsSchema } from '@/features/settings/validation/settings';
import { createAction } from '@/lib/actions/create-action';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { recordAuditEntry } from '@/lib/audit/record';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface UpdateInvoiceDefaultsResult {
  /** Identifier of the business whose defaults were saved. */
  companyId: string;
}

export const updateInvoiceDefaults = createAction(
  invoiceDefaultsSchema,
  async (input): Promise<UpdateInvoiceDefaultsResult> => {
    const { user, company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { error } = await supabase.from('company_profiles').upsert(
      {
        company_id: company.id,
        legal_name: company.legalName,
        invoice_prefix: input.invoicePrefix,
        estimate_prefix: input.estimatePrefix,
        receipt_prefix: input.receiptPrefix,
        number_padding: input.numberPadding,
        numbering_reset_policy: input.numberingResetPolicy,
        default_payment_terms_days: input.defaultPaymentTermsDays,
        default_notes: input.defaultNotes,
        default_terms: input.defaultTerms,
        default_footer_text: input.defaultFooterText,
        brand_primary_color: input.brandPrimaryColor.toUpperCase(),
        brand_accent_color: input.brandAccentColor.toUpperCase(),
        invoice_template_key: input.invoiceTemplateKey,
        paper_size: input.paperSize,
        show_platform_badge: input.showPlatformBadge,
        updated_by: user.id,
      },
      { onConflict: 'company_id' }
    );

    if (error) {
      logger.error('Could not save the document defaults', error, { companyId: company.id });

      throw new AppError('database_failure', 'The defaults could not be saved. Please try again.');
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'company_profile',
      entityId: company.id,
      companyId: company.id,
      description: 'Document defaults and branding updated.',
    });

    revalidatePath('/dashboard/settings/invoicing');

    return { companyId: company.id };
  },
  { name: 'updateInvoiceDefaults' }
);
