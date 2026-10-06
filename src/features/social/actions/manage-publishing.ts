// src/features/social/actions/manage-publishing.ts
// Connecting accounts, writing posts, approving them and scheduling them.
//
// Anything that goes out under the name of a business is treated as a
// publication rather than a message: it is written, read by an owner, and
// only then given a time.

'use server';

import { revalidatePath } from 'next/cache';

import {
  channelIdSchema,
  postIdSchema,
  savePostSchema,
  saveChannelSchema,
  saveRuleSchema,
  schedulePostSchema,
} from '@/features/social/validation/social';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { encryptSecret } from '@/lib/crypto/encryption';
import { secretHint } from '@/lib/crypto/hashing';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/** Where the publishing screens live, for cache invalidation. */
const PUBLISHING_PATH = '/dashboard/marketing/social';

export interface SaveChannelResult {
  /** Identifier of the connected account. */
  channelId: string;
}

export const saveSocialChannel = createAction(
  saveChannelSchema,
  async (input): Promise<SaveChannelResult> => {
    const { company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();
    const hasToken = input.accessToken !== undefined && input.accessToken !== '';

    const { data, error } = await supabase.rpc('save_social_channel', {
      p_company_id: company.id,
      p_platform: input.platform,
      p_account_name: input.accountName,
      p_account_handle: input.accountHandle ?? null,
      p_external_account_id: input.externalAccountId ?? null,
      p_access_token_encrypted: hasToken ? encryptSecret(input.accessToken ?? '') : null,
      p_refresh_token_encrypted: null,
      p_masked_hint: hasToken ? secretHint(input.accessToken ?? '') : null,
      p_token_expires_at: null,
      p_granted_scopes: [],
      p_channel_id: input.channelId ?? null,
    });

    if (error) {
      logger.error('A social account could not be connected', error, {
        companyId: company.id,
      });

      throw new AppError('database_failure', 'That account could not be connected.');
    }

    const channelId = typeof data === 'string' ? data : null;

    if (channelId === null) {
      throw new AppError('database_failure', 'It was saved but returned no reference.');
    }

    await recordAuditEntry({
      action: 'secret_change',
      entityType: 'social_channel',
      entityId: channelId,
      companyId: company.id,
      description: `Account connected for posting on ${input.platform}.`,
    });

    revalidatePath(PUBLISHING_PATH);

    return { channelId };
  },
  { name: 'saveSocialChannel' }
);

export interface DisconnectChannelResult {
  /** True when nothing more can be posted from that account. */
  isDisconnected: boolean;
}

export const disconnectSocialChannel = createAction(
  channelIdSchema,
  async (input): Promise<DisconnectChannelResult> => {
    const { company } = await requireOwner();

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('disconnect_social_channel', {
      p_channel_id: input.channelId,
    });

    if (error) {
      logger.error('A social account could not be disconnected', error);

      throw new AppError('database_failure', 'That account could not be disconnected.');
    }

    await recordAuditEntry({
      action: 'settings_change',
      entityType: 'social_channel',
      entityId: input.channelId,
      companyId: company.id,
      description: 'Account disconnected from posting.',
    });

    revalidatePath(PUBLISHING_PATH);

    return { isDisconnected: data === true };
  },
  { name: 'disconnectSocialChannel' }
);

export interface SavePostResult {
  /** Identifier of the post that was written. */
  postId: string;
}

export const saveSocialPost = createAction(
  savePostSchema,
  async (input): Promise<SavePostResult> => {
    const { company } = await requirePermission('settings', 'edit');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('save_social_post', {
      p_company_id: company.id,
      p_title: input.title,
      p_body: input.body,
      p_link_url: input.linkUrl ?? null,
      p_hashtags: input.hashtags,
      p_post_id: input.postId ?? null,
    });

    if (error) {
      logger.error('A post could not be written', error, { companyId: company.id });

      throw new AppError(
        'database_failure',
        'That post could not be saved. A post that has already gone out cannot be rewritten.'
      );
    }

    const postId = typeof data === 'string' ? data : null;

    if (postId === null) {
      throw new AppError('database_failure', 'It was saved but returned no reference.');
    }

    await recordAuditEntry({
      action: input.postId === undefined ? 'insert' : 'update',
      entityType: 'social_post',
      entityId: postId,
      companyId: company.id,
      description: `Post written: ${input.title}.`,
    });

    revalidatePath(PUBLISHING_PATH);

    return { postId };
  },
  { name: 'saveSocialPost' }
);

export interface ApprovePostResult {
  /** True when an owner has now read it. */
  isApproved: boolean;
}

export const approveSocialPost = createAction(
  postIdSchema,
  async (input): Promise<ApprovePostResult> => {
    const { company } = await requireOwner();

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('approve_social_post', {
      p_post_id: input.postId,
    });

    if (error) {
      logger.error('A post could not be approved', error);

      throw new AppError('database_failure', 'That post could not be approved.');
    }

    await recordAuditEntry({
      action: 'approve',
      entityType: 'social_post',
      entityId: input.postId,
      companyId: company.id,
      description: 'Post approved for publishing.',
    });

    revalidatePath(PUBLISHING_PATH);

    return { isApproved: data === true };
  },
  { name: 'approveSocialPost' }
);

export interface SchedulePostResult {
  /** How many accounts it will go out on. */
  channelCount: number;
}

export const scheduleSocialPost = createAction(
  schedulePostSchema,
  async (input): Promise<SchedulePostResult> => {
    const { company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('schedule_social_post', {
      p_post_id: input.postId,
      p_channel_ids: input.channelIds,
      p_scheduled_for: new Date(input.scheduledFor).toISOString(),
    });

    if (error) {
      logger.error('A post could not be scheduled', error, { companyId: company.id });

      throw new AppError(
        'database_failure',
        'That post could not be scheduled. Check the accounts are still connected.'
      );
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'social_post',
      entityId: input.postId,
      companyId: company.id,
      description: 'Post scheduled.',
    });

    revalidatePath(PUBLISHING_PATH);

    return { channelCount: typeof data === 'number' ? data : input.channelIds.length };
  },
  { name: 'scheduleSocialPost' }
);

export interface CancelPostResult {
  /** True when it will not go out. */
  isCancelled: boolean;
}

export const cancelSocialPost = createAction(
  postIdSchema,
  async (input): Promise<CancelPostResult> => {
    const { company } = await requirePermission('settings', 'edit');

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('cancel_social_post', {
      p_post_id: input.postId,
    });

    if (error) {
      logger.error('A post could not be cancelled', error);

      throw new AppError(
        'database_failure',
        'That post could not be stopped. It may already have gone out.'
      );
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'social_post',
      entityId: input.postId,
      companyId: company.id,
      description: 'Post cancelled before publishing.',
    });

    revalidatePath(PUBLISHING_PATH);

    return { isCancelled: data === true };
  },
  { name: 'cancelSocialPost' }
);

export interface SaveRuleResult {
  /** Identifier of the rule that was saved. */
  ruleId: string;
}

export const saveSocialRule = createAction(
  saveRuleSchema,
  async (input): Promise<SaveRuleResult> => {
    const { company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('save_social_auto_rule', {
      p_company_id: company.id,
      p_name: input.name,
      p_trigger_event: input.triggerEvent,
      p_body_template: input.bodyTemplate,
      p_channel_ids: input.channelIds,
      p_requires_approval: input.requiresApproval,
      p_minimum_hours_between_posts: input.minimumHoursBetweenPosts,
      p_is_active: input.isActive,
      p_link_template: null,
      p_rule_id: input.ruleId ?? null,
    });

    if (error) {
      logger.error('An automatic posting rule could not be saved', error, {
        companyId: company.id,
      });

      throw new AppError(
        'database_failure',
        'That rule could not be saved. A rule cannot be switched on with nowhere to post.'
      );
    }

    const ruleId = typeof data === 'string' ? data : null;

    if (ruleId === null) {
      throw new AppError('database_failure', 'It was saved but returned no reference.');
    }

    await recordAuditEntry({
      action: 'settings_change',
      entityType: 'social_auto_rule',
      entityId: ruleId,
      companyId: company.id,
      description: `Automatic posting rule ${input.name} saved.`,
      metadata: { trigger: input.triggerEvent, is_active: input.isActive },
    });

    revalidatePath(PUBLISHING_PATH);

    return { ruleId };
  },
  { name: 'saveSocialRule' }
);
