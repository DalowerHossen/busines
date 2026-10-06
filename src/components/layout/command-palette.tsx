'use client';

import Link from 'next/link';
import { FileSearch, Search } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AccountRole } from '@/types/auth';
import { searchGlobalDocuments } from '@/lib/core/search';
import type { SearchActor, SearchDocument, SearchEntityType, SearchResult } from '@/lib/core/types';
import { Dialog, DialogContent, DialogDescription, DialogTitle, Input } from '@/components/ui';
import { flattenNavigation, getVisibleNavigation } from './navigation-utils';
import { getNavIcon } from './nav-icons';

export function CommandPalette({
  role,
  open,
  onOpenChange,
  searchDocuments = [],
  searchActor,
  searchCompanyId,
}: {
  readonly role: AccountRole | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly searchDocuments?: readonly SearchDocument[];
  readonly searchActor?: SearchActor;
  readonly searchCompanyId?: string;
}): ReactNode {
  const [query, setQuery] = useState('');
  const items = useMemo(() => flattenNavigation(getVisibleNavigation(role)), [role]);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredItems = useMemo(() => {
    return normalizedQuery
      ? items.filter((item) => `${item.label} ${item.href}`.toLowerCase().includes(normalizedQuery))
      : items;
  }, [items, normalizedQuery]);
  const recordResults = useMemo(() => {
    if (!normalizedQuery || normalizedQuery.length < 2 || !searchActor || !searchCompanyId) {
      return [];
    }
    try {
      return searchGlobalDocuments({
        actor: searchActor,
        query: normalizedQuery,
        documents: searchDocuments,
        scope: { type: 'tenant', companyId: searchCompanyId },
        limit: 8,
      });
    } catch {
      return [];
    }
  }, [normalizedQuery, searchActor, searchCompanyId, searchDocuments]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-2xl" showClose={false}>
        <div className="border-b border-border p-4">
          <DialogTitle className="sr-only">Command palette</DialogTitle>
          <DialogDescription className="sr-only">
            Search workspace destinations and records
          </DialogDescription>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search workspace or press Escape to close"
              aria-label="Search workspace"
              className="pl-10"
            />
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Search navigation and your recent workspace records.</span>
            <kbd className="rounded border border-border bg-surface-muted px-1.5 py-0.5 font-mono">
              Esc
            </kbd>
          </div>
        </div>
        <div className="max-h-[min(28rem,60vh)] overflow-y-auto p-2">
          {recordResults.length > 0 ? (
            <ResultSection
              label="Records"
              results={recordResults}
              onOpen={() => onOpenChange(false)}
            />
          ) : null}
          <div className={recordResults.length > 0 ? 'mt-3' : undefined}>
            <p className="px-3 pb-2 pt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Workspace
            </p>
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => {
                const Icon = getNavIcon(item.iconName);
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    onClick={() => onOpenChange(false)}
                    className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-foreground hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <span>{item.label}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{item.href}</span>
                  </Link>
                );
              })
            ) : recordResults.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
                <FileSearch className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm font-medium text-foreground">No matching destinations.</p>
                <p className="text-xs text-muted-foreground">
                  Try a client, invoice, or module name.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ResultSection({
  label,
  results,
  onOpen,
}: {
  readonly label: string;
  readonly results: readonly SearchResult[];
  readonly onOpen: () => void;
}): ReactNode {
  return (
    <section aria-label={label}>
      <p className="px-3 pb-2 pt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      {results.map((result) => {
        const Icon = getSearchIcon(result.entityType);
        return (
          <Link
            key={result.id}
            href={result.href}
            onClick={onOpen}
            className="flex min-h-12 items-center gap-3 rounded-md px-3 text-sm text-foreground hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-brand-950"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{result.title}</span>
              {result.subtitle ? (
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {result.subtitle}
                </span>
              ) : null}
            </span>
            <span className="hidden text-xs text-muted-foreground sm:block">Open</span>
          </Link>
        );
      })}
    </section>
  );
}

function getSearchIcon(entityType: SearchEntityType) {
  const iconNames: Readonly<Record<SearchEntityType, string>> = {
    client: 'Users',
    company: 'Building2',
    invoice: 'FileText',
    estimate: 'FileSignature',
    payment: 'CreditCard',
    expense: 'Receipt',
    project: 'FolderKanban',
    support_ticket: 'LifeBuoy',
  };
  return getNavIcon(iconNames[entityType]);
}
