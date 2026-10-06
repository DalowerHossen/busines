// src/types/notification.ts
// In-app notification center domain types (R2 in
// docs/planning/FEATURE-REGISTRY.md). Delivery-channel adapters live in
// src/lib/communication; this file models the in-app record and consent.
import type { ISODateString, TenantScopedEntity, UUID } from '@/types/core';

/**
 * Where a notification can also be delivered, beyond the in-app bell.
 */
export type NotificationChannel = 'in_app' | 'email' | 'whatsapp' | 'sms' | 'telegram' | 'viber';

/**
 * The kind of event a notification represents, used to pick an icon and a
 * deep link target. This union must stay identical to the
 * `public.notification_type` enum in the database.
 */
export type NotificationType =
  | 'invoice_sent'
  | 'invoice_viewed'
  | 'invoice_paid'
  | 'invoice_overdue'
  | 'estimate_approved'
  | 'estimate_declined'
  | 'payment_received'
  | 'payment_failed'
  | 'payout_processed'
  | 'kyc_status_changed'
  | 'subscription_changed'
  | 'low_stock'
  | 'team_invitation'
  | 'support_reply'
  | 'system_announcement'
  | 'security_alert';

/**
 * One in-app notification for a specific user.
 */
export interface Notification extends TenantScopedEntity {
  readonly recipientUserId: UUID;
  readonly type: NotificationType;
  readonly title: string;
  readonly body: string;
  readonly linkPath: string | null;
  readonly readAt: ISODateString | null;
  readonly deliveredChannels: readonly NotificationChannel[];
}

/**
 * A user's per-channel opt-in consent for a given notification type,
 * respecting the project's explicit email/WhatsApp opt-in requirement.
 */
export interface NotificationPreference {
  readonly userId: UUID;
  readonly type: NotificationType;
  readonly channel: NotificationChannel;
  readonly isEnabled: boolean;
}
