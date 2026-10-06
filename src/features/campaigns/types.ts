// src/features/campaigns/types.ts
// The shapes the campaign screens work with.

export interface MarketingSegment {
  segmentId: string;
  name: string;
  description: string | null;
  memberCount: number;
  lastCalculatedAt: string | null;
  isActive: boolean;
}

export interface MarketingCampaign {
  campaignId: string;
  name: string;
  campaignType: string;
  status: string;
  subject: string | null;
  segmentName: string | null;
  scheduledFor: string | null;
  recipientCount: number;
  deliveredCount: number;
  openedCount: number;
  clickedCount: number;
  unsubscribedCount: number;
  openRate: string;
  clickRate: string;
  stepCount: number;
  updatedAt: string;
}

export interface MarketingReach {
  subscribed: number;
  unsubscribed: number;
  clientCount: number;
}
