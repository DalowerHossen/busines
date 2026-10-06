// src/features/files/actions/request-upload.ts
// Agreeing an upload before a single byte is sent.
//
// The size, the type and the remaining allowance are checked here, and what
// comes back is a short lived instruction the browser uses to send the file
// straight to the store. The bytes never pass through this server, which is
// what keeps a large upload from occupying a request thread.

'use server';

import { requestUploadSchema } from '@/features/files/validation/files';
import type { UploadTicket } from '@/features/files/types';
import { createAction } from '@/lib/actions/create-action';
import { requireTenant, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { consumeRateLimit } from '@/lib/security/rate-limit';
import { storageAdapterFor, storageTargetFrom } from '@/lib/storage/resolve-target';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getServiceSupabaseClient } from '@/lib/supabase/service';

export const requestFileUpload = createAction(
  requestUploadSchema,
  async (input): Promise<UploadTicket> => {
    const { user, company } = await requireTenant();
    requireWritableCompany(company);

    const decision = await consumeRateLimit({
      kind: 'file_upload',
      key: user.id,
      limit: 60,
      windowSeconds: 300,
    });

    if (!decision.isAllowed) {
      throw new AppError(
        'rate_limited',
        'That is a lot of uploads at once. Wait a moment and carry on.'
      );
    }

    const supabase = createServerSupabaseClient();

    const { data: sessionId, error } = await supabase.rpc('begin_upload_session', {
      p_company_id: company.id,
      p_file_name: input.fileName,
      p_mime_type: input.mimeType,
      p_byte_size: input.byteSize,
      p_file_purpose: input.filePurpose,
      p_owner_type: input.ownerType ?? null,
      p_owner_id: input.ownerId ?? null,
      p_is_multipart: false,
    });

    if (error || typeof sessionId !== 'string') {
      logger.error('An upload could not be agreed', error, { companyId: company.id });

      throw new AppError('validation_failed', error?.message ?? 'That file could not be accepted.');
    }

    const service = getServiceSupabaseClient();

    const { data: settings, error: settingsError } = await service.rpc('upload_session_target', {
      p_session_id: sessionId,
    });

    if (settingsError) {
      logger.error('The file store behind an upload could not be read', settingsError);

      throw new AppError('integration_failure', 'The file store could not be reached.');
    }

    const target = storageTargetFrom(settings);
    const adapter = storageAdapterFor(target.provider);
    const storageKey =
      settings !== null && typeof settings === 'object' && 'storage_key' in settings
        ? String((settings as { storage_key: unknown }).storage_key)
        : '';

    try {
      const instruction = await adapter.createUploadInstruction(target, storageKey, input.mimeType);

      return {
        sessionId,
        uploadUrl: instruction.url,
        method: instruction.method,
        headers: instruction.headers,
        expiresAt: instruction.expiresAt,
      };
    } catch (cause) {
      logger.error('An upload address could not be signed', cause, { companyId: company.id });

      await service.rpc('abort_upload_session', {
        p_session_id: sessionId,
        p_reason: 'The upload address could not be signed',
      });

      await service.rpc('record_storage_target_health', {
        p_target_id: target.targetId,
        p_succeeded: false,
        p_message: 'An upload address could not be signed',
      });

      throw new AppError(
        'integration_failure',
        'The file store is not accepting uploads at the moment.'
      );
    }
  },
  { name: 'requestFileUpload' }
);
