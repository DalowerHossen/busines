// src/features/site/actions/manage-site.ts
// Writing, publishing and moving the pages of the public website.

'use server';

import { revalidatePath } from 'next/cache';

import {
  pageIdSchema,
  pageStateSchema,
  redirectIdSchema,
  saveRedirectSchema,
  savePageSchema,
} from '@/features/site/validation/site';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface SavePageResult {
  /** Identifier of the page that was written. */
  pageId: string;
}

export const saveSitePage = createAction(
  savePageSchema,
  async (input): Promise<SavePageResult> => {
    await requireSuperAdmin();

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('save_site_page', {
      p_slug: input.slug,
      p_title: input.title,
      p_page_type: input.pageType,
      p_page_id: input.pageId ?? null,
      p_content_blocks: null,
      p_excerpt: input.excerpt ?? null,
      p_meta_title: input.metaTitle ?? null,
      p_meta_description: input.metaDescription ?? null,
      p_canonical_url: null,
      p_open_graph_title: null,
      p_open_graph_description: null,
      p_open_graph_image_url: null,
      p_robots_directive: input.robotsDirective,
      p_sitemap_priority: null,
      p_sitemap_change_frequency: null,
      p_show_in_navigation: input.showInNavigation,
      p_navigation_label: null,
      p_navigation_order: input.navigationOrder,
    });

    if (error) {
      logger.error('A website page could not be saved', error, { slug: input.slug });

      throw new AppError(
        'database_failure',
        'That page could not be saved. Another page may already use that address.'
      );
    }

    const pageId = typeof data === 'string' ? data : null;

    if (pageId === null) {
      throw new AppError('database_failure', 'The page was saved but returned no reference.');
    }

    await recordAuditEntry({
      action: input.pageId === undefined ? 'insert' : 'update',
      entityType: 'site_page',
      entityId: pageId,
      description: `Website page ${input.slug} saved.`,
    });

    revalidatePath('/admin/content');
    revalidatePath(`/${input.slug}`);

    return { pageId };
  },
  { name: 'saveSitePage' }
);

export interface PageStateResult {
  /** True when the page is now in front of the public. */
  isPublished: boolean;
}

export const setSitePageState = createAction(
  pageStateSchema,
  async (input): Promise<PageStateResult> => {
    await requireSuperAdmin();

    const supabase = createServerSupabaseClient();

    const { error } = await supabase.rpc('publish_site_page', {
      p_page_id: input.pageId,
      p_is_published: input.isPublished,
    });

    if (error) {
      logger.error('A website page could not be published', error);

      throw new AppError('database_failure', 'That page could not be changed.');
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'site_page',
      entityId: input.pageId,
      description: input.isPublished ? 'Website page published.' : 'Website page taken down.',
    });

    revalidatePath('/admin/content');

    return { isPublished: input.isPublished };
  },
  { name: 'setSitePageState' }
);

export interface RemovePageResult {
  /** True when the page is gone and its address points somewhere real. */
  isRemoved: boolean;
}

export const removeSitePage = createAction(
  pageIdSchema,
  async (input): Promise<RemovePageResult> => {
    await requireSuperAdmin();

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('delete_site_page', {
      p_page_id: input.pageId,
    });

    if (error) {
      logger.error('A website page could not be removed', error);

      throw new AppError('database_failure', 'That page could not be removed.');
    }

    await recordAuditEntry({
      action: 'soft_delete',
      entityType: 'site_page',
      entityId: input.pageId,
      description: 'Website page removed and its address redirected.',
    });

    revalidatePath('/admin/content');

    return { isRemoved: data === true };
  },
  { name: 'removeSitePage' }
);

export interface SaveRedirectResult {
  /** Identifier of the redirect that was written. */
  redirectId: string;
}

export const saveSiteRedirect = createAction(
  saveRedirectSchema,
  async (input): Promise<SaveRedirectResult> => {
    await requireSuperAdmin();

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('save_url_redirect', {
      p_source_path: input.sourcePath,
      p_target_path: input.targetPath,
      p_status_code: input.statusCode,
      p_reason: input.reason ?? null,
    });

    if (error) {
      logger.error('A redirect could not be saved', error, { source: input.sourcePath });

      throw new AppError(
        'validation_failed',
        error.message.includes('redirected')
          ? 'That destination is itself redirected. Point this at the final address instead.'
          : 'That redirect could not be saved.'
      );
    }

    const redirectId = typeof data === 'string' ? data : null;

    if (redirectId === null) {
      throw new AppError('database_failure', 'The redirect was saved but returned no reference.');
    }

    await recordAuditEntry({
      action: 'insert',
      entityType: 'url_redirect',
      entityId: redirectId,
      description: `${input.sourcePath} now points at ${input.targetPath}.`,
    });

    revalidatePath('/admin/content');

    return { redirectId };
  },
  { name: 'saveSiteRedirect' }
);

export interface RemoveRedirectResult {
  /** True when the redirect is retired. */
  isRemoved: boolean;
}

export const removeSiteRedirect = createAction(
  redirectIdSchema,
  async (input): Promise<RemoveRedirectResult> => {
    await requireSuperAdmin();

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('remove_url_redirect', {
      p_redirect_id: input.redirectId,
    });

    if (error) {
      logger.error('A redirect could not be retired', error);

      throw new AppError('database_failure', 'That redirect could not be retired.');
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'url_redirect',
      entityId: input.redirectId,
      description: 'Redirect retired.',
    });

    revalidatePath('/admin/content');

    return { isRemoved: data === true };
  },
  { name: 'removeSiteRedirect' }
);
