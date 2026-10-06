// src/features/site/types.ts
// The shapes the website editor and the public renderer work with.

export interface ContentBlock {
  kind: string;
  heading: string | null;
  body: string | null;
  items: readonly string[];
}

export interface PublicPage {
  pageId: string;
  slug: string;
  title: string;
  pageType: string;
  blocks: readonly ContentBlock[];
  excerpt: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  openGraphTitle: string | null;
  openGraphDescription: string | null;
  openGraphImageUrl: string | null;
  robotsDirective: string;
  updatedAt: string;
}

export interface EditablePage {
  pageId: string;
  slug: string;
  title: string;
  pageType: string;
  isPublished: boolean;
  showInNavigation: boolean;
  navigationOrder: number;
  metaTitle: string | null;
  metaDescription: string | null;
  robotsDirective: string;
  sitemapPriority: string;
  viewCount: number;
  updatedAt: string;
  seoWarning: string | null;
}

export interface SiteRedirect {
  redirectId: string;
  sourcePath: string;
  targetPath: string;
  statusCode: number;
  reason: string | null;
  isActive: boolean;
  hitCount: number;
  lastHitAt: string | null;
}
