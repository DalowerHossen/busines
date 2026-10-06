// src/features/platform/actions/save-setting.ts
// Changing a platform setting while the platform is running.

'use server';

import { revalidatePath } from 'next/cache';

import { platformSettingSchema } from '@/features/platform/validation/platform';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Json } from '@/types/json';

export interface SaveSettingResult {
  /** True when the new value is live. */
  isSaved: boolean;
}

/**
 * Turns what was typed into the shape the setting expects.
 *
 * @param raw What the person typed.
 * @returns The value to store.
 */
function toStoredValue(raw: string): Json {
  const trimmed = raw.trim();

  if (trimmed === 'true' || trimmed === 'false') {
    return trimmed === 'true';
  }

  if (trimmed !== '' && Number.isFinite(Number(trimmed)) && /^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed) as Json;
    } catch {
      return trimmed;
    }
  }

  return trimmed;
}

export const savePlatformSetting = createAction(
  platformSettingSchema,
  async (input): Promise<SaveSettingResult> => {
    await requireSuperAdmin();

    const supabase = createServerSupabaseClient();

    const { error } = await supabase.rpc('set_platform_setting', {
      p_setting_key: input.settingKey,
      p_value: toStoredValue(input.value),
    });

    if (error) {
      logger.error('A platform setting could not be changed', error, {
        setting: input.settingKey,
      });

      throw new AppError('database_failure', 'That setting could not be changed.');
    }

    await recordAuditEntry({
      action: 'settings_change',
      entityType: 'platform_setting',
      entityId: null,
      description: `Setting ${input.settingKey} changed.`,
      metadata: { setting_key: input.settingKey },
    });

    revalidatePath('/admin/platform');

    return { isSaved: true };
  },
  { name: 'savePlatformSetting' }
);
