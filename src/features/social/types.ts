// src/features/social/types.ts
// The shapes the publishing screens work with. A channel token is never one
// of them; only the hint of it.

export interface SocialChannel {
  channelId: string;
  platform: string;
  accountName: string;
  accountHandle: string | null;
  isConnected: boolean;
  isActive: boolean;
  maskedHint: string | null;
  tokenExpiresAt: string | null;
  connectionError: string | null;
  lastPublishedAt: string | null;
  postCount: number;
}

export interface SocialPost {
  postId: string;
  title: string;
  body: string;
  linkUrl: string | null;
  status: string;
  scheduledFor: string | null;
  publishedAt: string | null;
  approvedAt: string | null;
  channelCount: number;
  publishedCount: number;
  failedCount: number;
  createdAt: string;
}

export interface SocialRule {
  ruleId: string;
  name: string;
  triggerEvent: string;
  bodyTemplate: string;
  channelCount: number;
  requiresApproval: boolean;
  minimumHoursBetweenPosts: number;
  isActive: boolean;
  lastTriggeredAt: string | null;
  triggerCount: number;
}
