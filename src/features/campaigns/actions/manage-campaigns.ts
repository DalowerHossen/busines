// src/features/campaigns/actions/manage-campaigns.ts
// Writing campaigns, describing audiences, and deciding when a thing goes
// out to real people.
//
// Only an owner may schedule or stop a send. Staff can write and prepare as
// much as they like; the moment something reaches a client's inbox under
// the name of the business, it is the owner's decision.

'use server';

import { revalidatePath } from 'next/cache';

import {
  campaignIdSchema,
  saveCampaignSchema,
  saveSegmentSchema,
  saveStepSchema,
  scheduleCampaignSchema,
} from '@/features/campaigns/validation/campaign';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/** Where the campaign screens live, for cache invalidation. */
const CAMPAIGN_PATH = '/dashboard/marketing/campaigns';

export interface SaveSegmentResult {
  /** Identifier of the audience. */
  segmentId: string;
}

export const saveMarketingSegment = createAction(
  saveSegmentSchema,
  async (input): Promise<SaveSegmentResult> => {
    const { company } = await requirePermission('settings', 'edit');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('save_marketing_segment', {
      p_company_id: company.id,
      p_name: input.name,
      p_description: input.description ?? null,
      p_criteria: {},
      p_segment_id: input.segmentId ?? null,
    });

    if (error) {
      logger.error('An audience could not be saved', error, { companyId: company.id });

      throw new AppError(
        'database_failure',
        'That audience could not be saved. Another audience may already use that name.'
      );
    }

    const segmentId = typeof data === 'string' ? data : null;

    if (segmentId === null) {
      throw new AppError('database_failure', 'It was saved but returned no reference.');
    }

    await recordAuditEntry({
      action: input.segmentId === undefined ? 'insert' : 'update',
      entityType: 'marketing_segment',
      entityId: segmentId,
      companyId: company.id,
      description: `Audience ${input.name} saved.`,
    });

    revalidatePath(CAMPAIGN_PATH);

    return { segmentId };
  },
  { name: 'saveMarketingSegment' }
);

export interface SaveCampaignResult {
  /** Identifier of the campaign. */
  campaignId: string;
}

export const saveMarketingCampaign = createAction(
  saveCampaignSchema,
  async (input): Promise<SaveCampaignResult> => {
    const { company } = await requirePermission('settings', 'edit');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('save_marketing_campaign', {
      p_company_id: company.id,
      p_name: input.name,
      p_subject: input.subject,
      p_body_markdown: input.bodyMarkdown,
      p_campaign_type: input.campaignType,
      p_segment_id: input.segmentId ?? null,
      p_preheader: input.preheader ?? null,
      p_from_name: null,
      p_utm_campaign: null,
      p_campaign_id: input.campaignId ?? null,
    });

    if (error) {
      logger.error('A campaign could not be saved', error, { companyId: company.id });

      throw new AppError(
        'database_failure',
        'That campaign could not be saved. One that has started cannot be rewritten.'
      );
    }

    const campaignId = typeof data === 'string' ? data : null;

    if (campaignId === null) {
      throw new AppError('database_failure', 'It was saved but returned no reference.');
    }

    await recordAuditEntry({
      action: input.campaignId === undefined ? 'insert' : 'update',
      entityType: 'marketing_campaign',
      entityId: campaignId,
      companyId: company.id,
      description: `Campaign ${input.name} saved.`,
    });

    revalidatePath(CAMPAIGN_PATH);

    return { campaignId };
  },
  { name: 'saveMarketingCampaign' }
);

export interface ScheduleCampaignResult {
  /** How many people it will reach. */
  audienceSize: number;
}

export const scheduleMarketingCampaign = createAction(
  scheduleCampaignSchema,
  async (input): Promise<ScheduleCampaignResult> => {
    const { company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('schedule_marketing_campaign', {
      p_campaign_id: input.campaignId,
      p_scheduled_for: new Date(input.scheduledFor).toISOString(),
    });

    if (error) {
      logger.error('A campaign could not be scheduled', error, { companyId: company.id });

      throw new AppError(
        'database_failure',
        'That campaign could not be scheduled. It needs a subject and something to say.'
      );
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'marketing_campaign',
      entityId: input.campaignId,
      companyId: company.id,
      description: 'Campaign scheduled.',
    });

    revalidatePath(CAMPAIGN_PATH);

    return { audienceSize: typeof data === 'number' ? data : 0 };
  },
  { name: 'scheduleMarketingCampaign' }
);

export interface PauseCampaignResult {
  /** True when nothing more will be sent. */
  isPaused: boolean;
}

export const pauseMarketingCampaign = createAction(
  campaignIdSchema,
  async (input): Promise<PauseCampaignResult> => {
    const { company } = await requireOwner();

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('pause_marketing_campaign', {
      p_campaign_id: input.campaignId,
    });

    if (error) {
      logger.error('A campaign could not be stopped', error);

      throw new AppError(
        'database_failure',
        'That campaign could not be stopped. It may already have finished.'
      );
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'marketing_campaign',
      entityId: input.campaignId,
      companyId: company.id,
      description: 'Campaign stopped.',
    });

    revalidatePath(CAMPAIGN_PATH);

    return { isPaused: data === true };
  },
  { name: 'pauseMarketingCampaign' }
);

export interface SaveStepResult {
  /** Identifier of the message in the sequence. */
  stepId: string;
}

export const saveCampaignStep = createAction(
  saveStepSchema,
  async (input): Promise<SaveStepResult> => {
    const { company } = await requirePermission('settings', 'edit');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('save_campaign_step', {
      p_campaign_id: input.campaignId,
      p_step_number: input.stepNumber,
      p_name: input.name,
      p_subject: input.subject,
      p_body_markdown: input.bodyMarkdown,
      p_delay_hours: input.delayHours,
      p_step_id: input.stepId ?? null,
    });

    if (error) {
      logger.error('A campaign step could not be saved', error, { companyId: company.id });

      throw new AppError(
        'database_failure',
        'That message could not be saved. A sequence already running cannot be changed.'
      );
    }

    const stepId = typeof data === 'string' ? data : null;

    if (stepId === null) {
      throw new AppError('database_failure', 'It was saved but returned no reference.');
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'campaign_step',
      entityId: stepId,
      companyId: company.id,
      description: `Message ${input.name} saved in a sequence.`,
    });

    revalidatePath(CAMPAIGN_PATH);

    return { stepId };
  },
  { name: 'saveCampaignStep' }
);
