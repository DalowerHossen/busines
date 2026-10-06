// src/features/loyalty/types.ts
// The shapes the loyalty and review screens work with: the scheme, what
// points buy, who holds them, and what clients said afterwards.

export interface LoyaltyProgram {
  programId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  pointsPerCurrencyUnit: string;
  earnOn: string;
  minimumSpend: string;
  pointValue: string;
  minimumRedemptionPoints: number;
  redemptionMultiple: number;
  pointsExpireAfterMonths: number | null;
  silverThreshold: number | null;
  goldThreshold: number | null;
  platinumThreshold: number | null;
  termsUrl: string | null;
  currency: string;
  memberCount: number;
  pointsIssued: number;
  pointsRedeemed: number;
}

export interface LoyaltyReward {
  rewardId: string;
  name: string;
  description: string | null;
  rewardType: string;
  pointsCost: number;
  creditAmount: string | null;
  discountPercentage: string | null;
  minimumTier: string;
  stockQuantity: number | null;
  redeemedCount: number;
  perMemberLimit: number | null;
  isActive: boolean;
  availableFrom: string | null;
  availableUntil: string | null;
  displayOrder: number;
}

export interface LoyaltyMemberSummary {
  accountId: string;
  membershipNumber: string;
  clientId: string | null;
  clientName: string | null;
  tier: string;
  pointsBalance: number;
  pointsValue: string;
  pointsEarnedLifetime: number;
  pointsRedeemedLifetime: number;
  nextExpiryDate: string | null;
  lastEarnedAt: string | null;
  isSuspended: boolean;
}

export interface LoyaltyMovement {
  movementId: string;
  entryType: string;
  points: number;
  balanceAfter: number;
  reason: string;
  expiresOn: string | null;
  createdAt: string;
}

export interface LoyaltyRedemption {
  redemptionId: string;
  redemptionCode: string;
  rewardName: string | null;
  pointsSpent: number;
  rewardValue: string | null;
  currency: string;
  status: string;
  issuedAt: string;
  expiresOn: string | null;
  appliedAt: string | null;
}

export interface LoyaltyMemberDetail {
  accountId: string;
  membershipNumber: string;
  clientId: string | null;
  clientName: string | null;
  tier: string;
  tierAchievedAt: string | null;
  pointsBalance: number;
  pointsValue: string;
  currency: string;
  pointsEarnedLifetime: number;
  pointsRedeemedLifetime: number;
  pointsExpiredLifetime: number;
  joinedAt: string;
  nextExpiryDate: string | null;
  isSuspended: boolean;
  suspensionReason: string | null;
  movements: readonly LoyaltyMovement[];
  redemptions: readonly LoyaltyRedemption[];
}

export interface LoyaltyOverview {
  memberCount: number;
  pointsOutstanding: number;
  liabilityAmount: string;
  rewardsClaimed: number;
  rewardsWaiting: number;
  topTierMembers: number;
}

export interface ReviewRequestRecord {
  requestId: string;
  emailAddress: string;
  clientId: string | null;
  clientName: string | null;
  subjectType: string;
  subjectId: string | null;
  status: string;
  rating: number | null;
  comment: string | null;
  wouldRecommend: boolean | null;
  requestedAt: string;
  respondedAt: string | null;
  hasTestimonial: boolean;
}

export interface TestimonialRecord {
  testimonialId: string;
  reviewRequestId: string | null;
  authorName: string;
  authorTitle: string | null;
  authorCompany: string | null;
  quote: string;
  rating: number | null;
  isApproved: boolean;
  consentGiven: boolean;
  isFeatured: boolean;
  displaySurface: string;
  displayOrder: number;
  approvedAt: string | null;
  createdAt: string;
}

export interface ReviewOverview {
  responseCount: number;
  averageRating: string;
  promoterCount: number;
  detractorCount: number;
  recommendRate: string;
  waitingCount: number;
  publishedCount: number;
  unpublishedCount: number;
}
