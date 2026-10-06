// src/features/messaging/types.ts
// The shapes the outbox pages work with: what has been sent to clients, and
// what a colleague has asked the owner to send.

import type { ApprovalStatus, MessageStatus } from '@/types/enums';

export interface OutboxMessage {
  id: string;
  status: MessageStatus;
  templateKey: string | null;
  toEmail: string;
  toName: string | null;
  subject: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  createdAt: string;
  scheduledFor: string | null;
  sentAt: string | null;
  failureReason: string | null;
  openCount: number;
  attemptCount: number;
}

export interface SendRequest {
  id: string;
  documentKind: string;
  documentId: string;
  templateKey: string;
  recipientEmail: string;
  recipientName: string | null;
  customMessage: string | null;
  status: ApprovalStatus;
  requestedAt: string;
  requestedByName: string | null;
  declineReason: string | null;
}

export interface OutboxTotals {
  queued: number;
  sent: number;
  failed: number;
  pendingRequests: number;
}

export interface OutboxOverview {
  messages: readonly OutboxMessage[];
  requests: readonly SendRequest[];
  totals: OutboxTotals;
  /** True when the outbox could not be read and empty lists are shown. */
  isDegraded: boolean;
}

export interface MessagingChannelRecord {
  channelId: string;
  channel: OutboundChannelName;
  provider: string;
  displayName: string;
  senderNumber: string | null;
  senderHandle: string | null;
  isPlatformChannel: boolean;
  isActive: boolean;
  isVerified: boolean;
  routingPriority: number;
  costPerMessage: string;
  costCurrency: string;
  dailySendLimit: number | null;
  sentToday: number;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  lastUsedAt: string | null;
  lastError: string | null;
}

/** The channels a business can be configured to send on besides email. */
export type OutboundChannelName = 'sms' | 'whatsapp' | 'telegram' | 'viber';

export interface RouteStepRecord {
  stepOrder: number;
  channel: string;
  templateKey: string | null;
  waitMinutes: number;
  isRequired: boolean;
  maxAttempts: number;
}

export interface MessageRouteRecord {
  routeId: string;
  routeKey: string;
  name: string;
  description: string | null;
  isPlatformRoute: boolean;
  isActive: boolean;
  stopOnDelivery: boolean;
  stopOnEngagement: boolean;
  respectQuietHours: boolean;
  requiresConsent: boolean;
  steps: readonly RouteStepRecord[];
  runningCount: number;
}

export interface RouteActivityRecord {
  runId: string;
  routeName: string;
  clientName: string | null;
  relatedEntityType: string | null;
  status: string;
  attemptedChannels: readonly string[];
  deliveredChannel: string | null;
  nextActionAt: string | null;
  totalCost: string;
  startedAt: string;
  completedAt: string | null;
}

export interface InboundReplyRecord {
  inboundId: string;
  channel: string;
  fromAddress: string;
  bodyText: string | null;
  clientName: string | null;
  isOptOut: boolean;
  receivedAt: string;
}

export interface MessagingOverview {
  activeChannels: number;
  verifiedChannels: number;
  reachablePeople: number;
  optedOutPeople: number;
  runningRoutes: number;
  deliveredRoutes: number;
  exhaustedRoutes: number;
  unhandledReplies: number;
  spendLast30Days: string;
}
