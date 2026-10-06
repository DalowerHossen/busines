import type { AccountRole } from '@/types/auth';
import { getNavItemsForRole, type NavItem } from '@/config/navigation';

export interface BreadcrumbItem {
  readonly label: string;
  readonly href: string | null;
}

export function getVisibleNavigation(role: AccountRole | null): readonly NavItem[] {
  return role ? getNavItemsForRole(role) : [];
}

export function buildBreadcrumbs(
  pathname: string,
  role: AccountRole | null
): readonly BreadcrumbItem[] {
  const normalizedPath = normalizePath(pathname);
  const matchingTrail = findTrail(getVisibleNavigation(role), normalizedPath);
  if (matchingTrail.length === 0) return [];
  const finalHref = matchingTrail[matchingTrail.length - 1]?.href;
  if (finalHref === normalizedPath) return matchingTrail;
  const remainder = normalizedPath
    .slice(finalHref?.length ?? 0)
    .split('/')
    .filter(Boolean);
  return [
    ...matchingTrail,
    ...remainder.map((segment, index) => ({
      label: humanizeSegment(segment),
      href: index === remainder.length - 1 ? null : null,
    })),
  ];
}

export function flattenNavigation(items: readonly NavItem[]): readonly NavItem[] {
  return items.flatMap((item) => [
    item,
    ...(item.children ? flattenNavigation(item.children) : []),
  ]);
}

function findTrail(items: readonly NavItem[], pathname: string): readonly BreadcrumbItem[] {
  let best: readonly BreadcrumbItem[] = [];
  for (const item of items) {
    const isMatch = pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (!isMatch) continue;
    const candidate: BreadcrumbItem[] = [{ label: item.label, href: item.href }];
    if (item.children) {
      const childTrail = findTrail(item.children, pathname);
      if (childTrail.length > 0) candidate.push(...childTrail);
    }
    if (candidate.length > best.length) best = candidate;
  }
  return best;
}

function normalizePath(pathname: string): string {
  const withoutQuery = pathname.split('?')[0] ?? pathname;
  const withoutHash = withoutQuery.split('#')[0] ?? withoutQuery;
  const normalized = `/${withoutHash.split('/').filter(Boolean).join('/')}`;
  return normalized === '/' ? normalized : normalized.replace(/\/$/u, '');
}

function humanizeSegment(segment: string): string {
  return decodeURIComponent(segment)
    .replace(/[-_]+/gu, ' ')
    .replace(/\b\w/gu, (character) => character.toUpperCase());
}
