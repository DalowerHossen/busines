// src/features/marketplace/actions/install-template.ts
// Buying and installing a template in one step. A free template is simply
// installed; a paid one is ordered against the platform account of the
// business and appears on its next platform invoice.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { installTemplateSchema } from '@/features/marketplace/validation/marketplace';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow, readString } from '@/lib/records';
import { getServiceSupabaseClient } from '@/lib/supabase/service';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface InstallTemplateResult {
  /** Identifier of the install now live inside the business. */
  installId: string;
  /** Reference of the order the install was paid for under, when it was paid. */
  orderReference: string | null;
}

export const installTemplate = createAction(
  installTemplateSchema,
  async (input): Promise<InstallTemplateResult> => {
    const { company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data: orderId, error: purchaseError } = await supabase.rpc('purchase_listing', {
      p_company_id: company.id,
      p_listing_id: input.listingId,
      p_payment_reference: `account:${company.id}`,
    });

    if (purchaseError) {
      logger.error('A marketplace order could not be created', purchaseError, {
        companyId: company.id,
      });

      throw new AppError('database_failure', purchaseError.message);
    }

    const service = getServiceSupabaseClient();

    const { data: orderData, error: orderError } = await service
      .from('marketplace_orders')
      .select('id, order_reference, status, pricing_model')
      .eq('id', typeof orderId === 'string' ? orderId : '')
      .maybeSingle();

    if (orderError) {
      logger.error('The marketplace order could not be read back', orderError, {
        companyId: company.id,
      });

      throw new AppError('database_failure', 'The order was not completed. Please try again.');
    }

    const order = asRow(orderData);
    const orderReference = order === null ? null : readString(order, 'order_reference');

    if (order !== null && readString(order, 'status') === 'pending') {
      const { error: confirmError } = await service.rpc('confirm_marketplace_order', {
        p_order_id: readString(order, 'id') ?? '',
        p_payment_reference: `account:${company.id}`,
      });

      if (confirmError) {
        logger.error('The marketplace order could not be confirmed', confirmError, {
          companyId: company.id,
        });

        throw new AppError('database_failure', 'The payment was not completed. Please try again.');
      }
    }

    const { data: installId, error: installError } = await supabase.rpc('install_listing', {
      p_company_id: company.id,
      p_listing_id: input.listingId,
      p_configuration: {},
    });

    if (installError) {
      logger.error('A template could not be installed', installError, { companyId: company.id });

      throw new AppError('database_failure', installError.message);
    }

    await recordAuditEntry({
      action: 'insert',
      entityType: 'marketplace_install',
      entityId: typeof installId === 'string' ? installId : '',
      companyId: company.id,
      description: 'Installed a template from the marketplace.',
      metadata: { orderReference },
    });

    revalidatePath(ROUTES.marketplace);

    return { installId: typeof installId === 'string' ? installId : '', orderReference };
  },
  { name: 'installTemplate' }
);
