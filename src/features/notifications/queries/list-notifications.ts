// src/features/notifications/queries/list-notifications.ts
// Reading the notification bell for one account.
//
// Notifications belong to a person, not to a business, so the query is
// scoped by user and then narrowed to the company being worked inside plus
// the platform-wide announcements that carry no company at all. A failure
// returns an empty list rather than breaking the layout that renders it.

import 'server-only';

import { logger } from '@/lib/logger';
import { asRows, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { DatabaseRow } from '@/types/database';
import type { Notification, NotificationType } from '@/types/notification';
import type { ISODateString, UUID } from '@/types/core';

/** How many notifications the bell holds at once. */
const MAXIMUM_NOTIFICATIONS = 50;

/**
 * Turns a database row into the notification shape the interface renders.
 *
 * @param row Row read from public.notifications.
 * @param companyId Company the request is being made inside.
 * @returns The notification as the notification centre needs it.
 */
function toNotification(row: DatabaseRow, companyId: string): Notification {
  const createdAt = (readString(row, 'created_at') ?? '') as ISODateString;

  return {
    id: (readString(row, 'id') ?? '') as UUID,
    companyId: (readString(row, 'company_id') ?? companyId) as UUID,
    createdAt,
    updatedAt: (readString(row, 'updated_at') ?? createdAt) as ISODateString,
    deletedAt: null,
    recipientUserId: (readString(row, 'user_id') ?? '') as UUID,
    type: (readString(row, 'notification_kind') ?? 'system_announcement') as NotificationType,
    title: readString(row, 'title') ?? '',
    body: readString(row, 'body') ?? '',
    linkPath: readString(row, 'action_url'),
    readAt: readString(row, 'read_at') as ISODateString | null,
    deliveredChannels: ['in_app'],
  };
}

/**
 * Lists the notifications shown in the bell for one account.
 *
 * @param userId Account the notifications belong to.
 * @param companyId Business being worked inside.
 * @returns The newest notifications, or an empty list when the read fails.
 */
export async function listNotifications(
  userId: string,
  companyId: string
): Promise<readonly Notification[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('notifications')
    .select(
      'id, user_id, company_id, notification_kind, title, body, action_url, read_at, created_at, updated_at'
    )
    .eq('user_id', userId)
    .or(`company_id.eq.${companyId},company_id.is.null`)
    .is('dismissed_at', null)
    .order('created_at', { ascending: false })
    .limit(MAXIMUM_NOTIFICATIONS);

  if (error) {
    logger.error('The notifications could not be read', error, { companyId });
    return [];
  }

  return asRows(data).map((row) => toNotification(row, companyId));
}
