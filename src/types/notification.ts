// src/types/notification.ts
// In-app notification center domain types (R2 in
// docs/planning/FEATURE-REGISTRY.md). Delivery-channel adapters
// (WhatsApp/SMS/Telegram/Viber/email) are implemented in a later phase;
// this file only models the in-app notification record and consent.
import type { ISODateString, TenantScopedEntity, UUID } from '@/types/core';

/**
 * Where a notification can also be delivered, beyond the in-app bell.
 */
export type NotificationChannel = 'in_app' | 'email' | 'whatsapp' | 'sms' | 'telegram' | 'viber';

/**
 * The kind of event a notification represents, used to pick an icon and a
 * deep link target.
 */
export type NotificationType =
  | 'invoice_viewed'
  | 'invoice_paid'
  | 'invoice_overdue'
  | 'payment_failed'
  | 'estimate_approved'
  | 'estimate_declined'
  | 'staff_invited'
  | 'kyc_status_changed'
  | 'payout_processed'
  | 'low_stock_alert'
  | 'subscription_renewal_due'
  | 'system_announcement';

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
