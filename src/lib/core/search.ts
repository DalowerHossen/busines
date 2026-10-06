import { invalidCoreRequest, tenantScopeDenied } from './errors';
import type { SearchActor, SearchDocument, SearchResult } from './types';

export function searchGlobalDocuments(input: {
  readonly actor: SearchActor;
  readonly query: string;
  readonly documents: readonly SearchDocument[];
  readonly scope:
    | { readonly type: 'tenant'; readonly companyId: string }
    | { readonly type: 'platform' };
  readonly limit?: number;
}): readonly SearchResult[] {
  const queryTokens = tokenize(input.query);
  const limit = input.limit ?? 20;
  if (
    queryTokens.length === 0 ||
    queryTokens.join('').length < 2 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 50
  ) {
    throw invalidCoreRequest();
  }
  const scopedDocuments = scopeDocuments(input.actor, input.scope, input.documents);
  return scopedDocuments
    .map((document) => scoreDocument(document, queryTokens))
    .filter((result): result is SearchResult => result !== null)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (right.updatedAt !== left.updatedAt) return right.updatedAt.localeCompare(left.updatedAt);
      return left.id.localeCompare(right.id);
    })
    .slice(0, limit);
}

function scopeDocuments(
  actor: SearchActor,
  scope: { readonly type: 'tenant'; readonly companyId: string } | { readonly type: 'platform' },
  documents: readonly SearchDocument[]
): readonly SearchDocument[] {
  if (!actor.userId.trim()) throw invalidCoreRequest();
  if (scope.type === 'platform') {
    if (actor.role !== 'super_admin') throw tenantScopeDenied();
    return documents;
  }
  if (!scope.companyId.trim() || !actor.companyIds.includes(scope.companyId)) {
    throw tenantScopeDenied();
  }
  return documents.filter((document) => document.companyId === scope.companyId);
}

function scoreDocument(document: SearchDocument, tokens: readonly string[]): SearchResult | null {
  validateSearchDocument(document);
  const fields = {
    title: normalizeText(document.title),
    subtitle: normalizeText(document.subtitle ?? ''),
    search_text: normalizeText(document.searchText),
  } as const;
  const matchedFields = new Set<'title' | 'subtitle' | 'search_text'>();
  let score = 0;
  for (const token of tokens) {
    const titleMatch = fields.title.includes(token);
    const subtitleMatch = fields.subtitle.includes(token);
    const searchTextMatch = fields.search_text.includes(token);
    if (!titleMatch && !subtitleMatch && !searchTextMatch) return null;
    if (titleMatch) {
      matchedFields.add('title');
      score += fields.title === token ? 1 : fields.title.startsWith(token) ? 0.85 : 0.7;
    }
    if (subtitleMatch) {
      matchedFields.add('subtitle');
      score += 0.35;
    }
    if (searchTextMatch) {
      matchedFields.add('search_text');
      score += 0.15;
    }
  }
  return { ...document, score, matchedFields: [...matchedFields] };
}

function validateSearchDocument(document: SearchDocument): void {
  if (
    !document.id.trim() ||
    !document.title.trim() ||
    !document.entityType ||
    !document.href.startsWith('/') ||
    document.href.startsWith('//') ||
    !Number.isFinite(Date.parse(document.updatedAt))
  ) {
    throw invalidCoreRequest();
  }
}

function tokenize(value: string): readonly string[] {
  return [
    ...new Set(
      normalizeText(value)
        .split(/[^a-z0-9@._-]+/u)
        .filter(Boolean)
    ),
  ];
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}
