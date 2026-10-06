// src/features/loyalty/queries/list-reviews.ts
// Reading what clients were asked, what they answered, and which answers
// have been turned into quotes.

import type {
  ReviewOverview,
  ReviewRequestRecord,
  TestimonialRecord,
} from '@/features/loyalty/types';
import { logger } from '@/lib/logger';
import { asRows, readBoolean, readNumber, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isJsonObject, type JsonObject } from '@/types/json';

export interface ReviewBoardResult {
  requests: readonly ReviewRequestRecord[];
  testimonials: readonly TestimonialRecord[];
  overview: ReviewOverview;
  /** True when the read failed. */
  isDegraded: boolean;
}

const EMPTY_OVERVIEW: ReviewOverview = {
  responseCount: 0,
  averageRating: '0',
  promoterCount: 0,
  detractorCount: 0,
  recommendRate: '0',
  waitingCount: 0,
  publishedCount: 0,
  unpublishedCount: 0,
};

/**
 * Reads a whole number out of the overview.
 *
 * @param source The overview as the database returned it.
 * @param key Field being read.
 * @returns The number, or nothing.
 */
function whole(source: JsonObject, key: string): number {
  const value = source[key];

  return typeof value === 'number' ? value : Number(value ?? 0) || 0;
}

/**
 * Reads a figure that is shown rather than counted.
 *
 * @param source The overview as the database returned it.
 * @param key Field being read.
 * @returns The figure as text.
 */
function figure(source: JsonObject, key: string): string {
  const value = source[key];

  if (typeof value === 'string') {
    return value;
  }

  return typeof value === 'number' ? String(value) : '0';
}

/**
 * Reads the review board of one business.
 *
 * @param companyId Business whose reviews are being read.
 * @returns The invitations, the quotes, the counts and whether it failed.
 */
export async function loadReviewBoard(companyId: string): Promise<ReviewBoardResult> {
  const supabase = createServerSupabaseClient();

  const [requests, testimonials, overview] = await Promise.all([
    supabase.rpc('company_review_requests', {
      p_company_id: companyId,
      p_status: null,
      p_limit: 100,
    }),
    supabase.rpc('company_testimonials', { p_company_id: companyId }),
    supabase.rpc('review_overview', { p_company_id: companyId }),
  ]);

  if (requests.error || testimonials.error || overview.error) {
    logger.error(
      'The reviews could not be read',
      requests.error ?? testimonials.error ?? overview.error,
      { companyId }
    );

    return { requests: [], testimonials: [], overview: EMPTY_OVERVIEW, isDegraded: true };
  }

  const counts = isJsonObject(overview.data) ? overview.data : {};

  return {
    requests: asRows(requests.data).map((row) => ({
      requestId: readString(row, 'request_id') ?? '',
      emailAddress: readString(row, 'email_address') ?? '',
      clientId: readString(row, 'client_id'),
      clientName: readString(row, 'client_name'),
      subjectType: readString(row, 'subject_type') ?? 'invoice',
      subjectId: readString(row, 'subject_id'),
      status: readString(row, 'status') ?? 'pending',
      rating: readNumber(row, 'rating'),
      comment: readString(row, 'comment'),
      wouldRecommend: typeof row.would_recommend === 'boolean' ? row.would_recommend : null,
      requestedAt: readString(row, 'requested_at') ?? '',
      respondedAt: readString(row, 'responded_at'),
      hasTestimonial: readBoolean(row, 'has_testimonial'),
    })),
    testimonials: asRows(testimonials.data).map((row) => ({
      testimonialId: readString(row, 'testimonial_id') ?? '',
      reviewRequestId: readString(row, 'review_request_id'),
      authorName: readString(row, 'author_name') ?? '',
      authorTitle: readString(row, 'author_title'),
      authorCompany: readString(row, 'author_company'),
      quote: readString(row, 'quote') ?? '',
      rating: readNumber(row, 'rating'),
      isApproved: readBoolean(row, 'is_approved'),
      consentGiven: readBoolean(row, 'consent_given'),
      isFeatured: readBoolean(row, 'is_featured'),
      displaySurface: readString(row, 'display_surface') ?? 'home',
      displayOrder: readNumber(row, 'display_order') ?? 100,
      approvedAt: readString(row, 'approved_at'),
      createdAt: readString(row, 'created_at') ?? '',
    })),
    overview: {
      responseCount: whole(counts, 'response_count'),
      averageRating: figure(counts, 'average_rating'),
      promoterCount: whole(counts, 'promoter_count'),
      detractorCount: whole(counts, 'detractor_count'),
      recommendRate: figure(counts, 'recommend_rate'),
      waitingCount: whole(counts, 'waiting_count'),
      publishedCount: whole(counts, 'published_count'),
      unpublishedCount: whole(counts, 'unpublished_count'),
    },
    isDegraded: false,
  };
}
