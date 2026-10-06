// src/features/marketplace/types.ts
// The shapes the template marketplace works with: what is on sale, what a
// business has installed, and what a vendor is owed for it.

export interface CatalogueEntry {
  listingId: string;
  listingSlug: string;
  title: string;
  summary: string;
  category: string;
  artifactKind: string;
  pricingModel: string;
  priceAmount: string;
  priceCurrency: string;
  version: string;
  installCount: number;
  averageRating: string | null;
  ratingCount: number;
  vendorId: string;
  vendorName: string;
  vendorSlug: string;
  publishedAt: string | null;
}

export interface ListingDetail extends CatalogueEntry {
  description: string | null;
  tags: readonly string[];
  demoUrl: string | null;
  vendorHeadline: string | null;
  vendorSupportEmail: string | null;
}

export interface ListingReview {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  vendorReply: string | null;
  createdAt: string;
}

export interface InstalledTemplate {
  installId: string;
  listingId: string;
  listingSlug: string;
  title: string;
  category: string;
  installedVersion: string;
  latestVersion: string;
  status: string;
  installedAt: string;
  hasReview: boolean;
}

export interface VendorProfile {
  id: string;
  companyId: string | null;
  vendorName: string;
  vendorSlug: string;
  headline: string | null;
  bio: string | null;
  supportEmail: string | null;
  websiteUrl: string | null;
  status: string;
  revenueSharePercentage: string;
  payoutCurrency: string;
  listingCount: number;
  installCount: number;
  lifetimeEarnings: string;
  averageRating: string | null;
  approvedAt: string | null;
}

export interface VendorListing {
  listingId: string;
  listingSlug: string;
  title: string;
  category: string;
  pricingModel: string;
  priceAmount: string;
  priceCurrency: string;
  version: string;
  status: string;
  installCount: number;
  purchaseCount: number;
  ratingCount: number;
  reviewNotes: string | null;
  submittedAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
}

export interface VendorEarnings {
  pendingAmount: string;
  availableAmount: string;
  paidAmount: string;
  reversedAmount: string;
  currency: string;
}

export interface VendorDesk {
  profile: VendorProfile | null;
  listings: readonly VendorListing[];
  earnings: VendorEarnings | null;
  isDegraded: boolean;
}

export interface ListingQueueEntry {
  listingId: string;
  title: string;
  summary: string;
  category: string;
  artifactKind: string;
  pricingModel: string;
  priceAmount: string;
  priceCurrency: string;
  version: string;
  status: string;
  submittedAt: string | null;
  vendorId: string;
  vendorName: string;
  vendorStatus: string;
}
