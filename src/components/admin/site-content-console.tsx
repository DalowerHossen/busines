// src/components/admin/site-content-console.tsx
// The public website, edited by the people who write it.
//
// Two lists. The pages, each with the title and description a search engine
// will actually show, and a warning when either is missing. And the
// addresses that used to work, because the day a page moves is the day a
// hundred links start pointing at nothing unless somebody catches it.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { notify } from '@/components/ui/toaster';
import {
  removeSitePage,
  removeSiteRedirect,
  saveSitePage,
  saveSiteRedirect,
  setSitePageState,
} from '@/features/site/actions/manage-site';
import type { EditablePage, SiteRedirect } from '@/features/site/types';
import { PAGE_TYPES } from '@/features/site/validation/site';
import { formatDateTime } from '@/lib/dates';
import { formatNumber, humanise } from '@/lib/format';

export interface SiteContentConsoleProps {
  /** The pages of the public website. */
  pages: readonly EditablePage[];
  /** The addresses that moved. */
  redirects: readonly SiteRedirect[];
}

type PageType = (typeof PAGE_TYPES)[number];

/**
 * Renders the website editor.
 *
 * @param props The pages and the redirects.
 * @returns The rendered console.
 */
export function SiteContentConsole({ pages, redirects }: SiteContentConsoleProps) {
  const router = useRouter();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [pageType, setPageType] = useState<PageType>('marketing');
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [robots, setRobots] = useState('index,follow');
  const [showInNavigation, setShowInNavigation] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const [sourcePath, setSourcePath] = useState('');
  const [targetPath, setTargetPath] = useState('');
  const [statusCode, setStatusCode] = useState('301');
  const [isSavingRedirect, setIsSavingRedirect] = useState(false);

  /**
   * Opens the editor against one page, or a blank one.
   *
   * @param page The page being edited, or null for a new one.
   * @returns Nothing.
   */
  function openEditor(page: EditablePage | null): void {
    setEditingId(page === null ? 'new' : page.pageId);
    setSlug(page?.slug ?? '');
    setTitle(page?.title ?? '');
    setPageType((page?.pageType ?? 'marketing') as PageType);
    setMetaTitle(page?.metaTitle ?? '');
    setMetaDescription(page?.metaDescription ?? '');
    setRobots(page?.robotsDirective ?? 'index,follow');
    setShowInNavigation(page?.showInNavigation ?? false);
    setFieldErrors({});
  }

  /**
   * Saves whatever is in the editor.
   *
   * @returns Nothing.
   */
  async function onSavePage(): Promise<void> {
    setIsSaving(true);
    setFieldErrors({});

    const result = await saveSitePage({
      pageId: editingId === 'new' || editingId === null ? undefined : editingId,
      slug,
      title,
      pageType,
      metaTitle: metaTitle === '' ? undefined : metaTitle,
      metaDescription: metaDescription === '' ? undefined : metaDescription,
      robotsDirective: robots as 'index,follow',
      showInNavigation,
      navigationOrder: 100,
    });

    setIsSaving(false);

    if (!result.success) {
      setFieldErrors(result.fieldErrors ?? {});
      notify.error(result.error);

      return;
    }

    notify.success('Saved. If the address changed, the old one now redirects here.');
    setEditingId(null);
    router.refresh();
  }

  /**
   * Publishes a page or takes it down.
   *
   * @param page The page being changed.
   * @returns Nothing.
   */
  async function onToggle(page: EditablePage): Promise<void> {
    const result = await setSitePageState({
      pageId: page.pageId,
      isPublished: !page.isPublished,
    });

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success(page.isPublished ? 'Taken down.' : 'Published.');
    router.refresh();
  }

  /**
   * Removes a page and redirects its address.
   *
   * @param pageId Page being removed.
   * @returns Nothing.
   */
  async function onRemovePage(pageId: string): Promise<void> {
    const result = await removeSitePage({ pageId });

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success('Removed. Its address now points at the home page.');
    router.refresh();
  }

  /**
   * Adds a redirect.
   *
   * @returns Nothing.
   */
  async function onSaveRedirect(): Promise<void> {
    setIsSavingRedirect(true);

    const result = await saveSiteRedirect({
      sourcePath,
      targetPath,
      statusCode,
    });

    setIsSavingRedirect(false);

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success('Saved. Anybody following the old link lands in the right place.');
    setSourcePath('');
    setTargetPath('');
    router.refresh();
  }

  /**
   * Retires a redirect.
   *
   * @param redirectId Redirect being retired.
   * @returns Nothing.
   */
  async function onRemoveRedirect(redirectId: string): Promise<void> {
    const result = await removeSiteRedirect({ redirectId });

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success('Retired.');
    router.refresh();
  }

  const warnings = pages.filter((page) => page.seoWarning !== null).length;

  return (
    <div className="space-y-6">
      {warnings === 0 ? null : (
        <Alert tone="warning" title="Some pages are not ready to be found">
          {`${formatNumber(warnings)} pages are missing the title or description a search engine would show, or are published but hidden from search. They are marked below.`}
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Pages</CardTitle>
              <CardDescription>
                Everything the public can read, with the words a search engine will show.
              </CardDescription>
            </div>
            <Button onClick={() => openEditor(null)}>Write a new page</Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {editingId === null ? null : (
            <div className="space-y-4 rounded-lg border border-border p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  id="page-title"
                  label="Title"
                  hint="The heading at the top of the page."
                  errors={fieldErrors['title']}
                  isRequired
                >
                  <Input
                    id="page-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </FormField>

                <FormField
                  id="page-slug"
                  label="Address"
                  hint="What comes after the domain name."
                  errors={fieldErrors['slug']}
                  isRequired
                >
                  <Input
                    id="page-slug"
                    value={slug}
                    onChange={(event) => setSlug(event.target.value)}
                  />
                </FormField>

                <FormField id="page-type" label="Kind of page">
                  <Select
                    id="page-type"
                    value={pageType}
                    options={PAGE_TYPES.map((entry) => ({
                      value: entry,
                      label: humanise(entry),
                    }))}
                    onChange={(event) => setPageType(event.target.value as PageType)}
                  />
                </FormField>

                <FormField
                  id="page-robots"
                  label="Search engines"
                  hint="Leave on the first option unless there is a reason not to."
                >
                  <Select
                    id="page-robots"
                    value={robots}
                    options={[
                      { value: 'index,follow', label: 'Find it and follow its links' },
                      { value: 'index,nofollow', label: 'Find it, ignore its links' },
                      { value: 'noindex,follow', label: 'Keep it out of results' },
                      { value: 'noindex,nofollow', label: 'Keep it out entirely' },
                    ]}
                    onChange={(event) => setRobots(event.target.value)}
                  />
                </FormField>
              </div>

              <FormField
                id="page-meta-title"
                label="Title in search results"
                hint="Between ten and seventy characters. Longer is cut off."
                errors={fieldErrors['metaTitle']}
              >
                <Input
                  id="page-meta-title"
                  value={metaTitle}
                  onChange={(event) => setMetaTitle(event.target.value)}
                />
              </FormField>

              <FormField
                id="page-meta-description"
                label="Description in search results"
                hint="Between fifty and one hundred and sixty characters."
                errors={fieldErrors['metaDescription']}
              >
                <Textarea
                  id="page-meta-description"
                  rows={2}
                  value={metaDescription}
                  onChange={(event) => setMetaDescription(event.target.value)}
                />
              </FormField>

              <Checkbox
                id="page-navigation"
                label="Show this in the site navigation"
                description="Only for pages a visitor should be able to find without a link."
                checked={showInNavigation}
                onChange={(event) => setShowInNavigation(event.target.checked)}
              />

              <div className="flex flex-wrap gap-2">
                <Button
                  isLoading={isSaving}
                  loadingLabel="Saving"
                  onClick={() => void onSavePage()}
                >
                  Save this page
                </Button>
                <Button variant="ghost" onClick={() => setEditingId(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {pages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing has been written in the editor yet. The pages built into the product are still
              live.
            </p>
          ) : (
            <ul className="space-y-3">
              {pages.map((page) => (
                <li
                  key={page.pageId}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-4"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">{page.title}</p>
                      <Badge tone={page.isPublished ? 'success' : 'neutral'}>
                        {page.isPublished ? 'Published' : 'Draft'}
                      </Badge>
                      <Badge tone="neutral">{humanise(page.pageType)}</Badge>
                      {page.seoWarning === null ? null : (
                        <Badge tone="warning">{page.seoWarning}</Badge>
                      )}
                    </div>
                    <p className="tabular text-sm text-muted-foreground">{`/${page.slug}`}</p>
                    <p className="text-sm text-muted-foreground">
                      {`${formatNumber(page.viewCount)} views, changed ${formatDateTime(page.updatedAt)}`}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => openEditor(page)}>
                      Edit
                    </Button>
                    <Button variant="ghost" onClick={() => void onToggle(page)}>
                      {page.isPublished ? 'Take it down' : 'Publish'}
                    </Button>
                    <Button variant="ghost" onClick={() => void onRemovePage(page.pageId)}>
                      Remove
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Addresses that moved</CardTitle>
          <CardDescription>
            A link somebody shared years ago should still arrive somewhere useful. Moving a page in
            the editor writes its redirect by itself; anything else goes here.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField id="redirect-source" label="Old address" isRequired>
              <Input
                id="redirect-source"
                value={sourcePath}
                onChange={(event) => setSourcePath(event.target.value)}
              />
            </FormField>

            <FormField id="redirect-target" label="Where it should go" isRequired>
              <Input
                id="redirect-target"
                value={targetPath}
                onChange={(event) => setTargetPath(event.target.value)}
              />
            </FormField>

            <FormField id="redirect-status" label="Kind of move">
              <Select
                id="redirect-status"
                value={statusCode}
                options={[
                  { value: '301', label: 'Permanent' },
                  { value: '302', label: 'Temporary' },
                  { value: '307', label: 'Temporary, keep the method' },
                  { value: '308', label: 'Permanent, keep the method' },
                ]}
                onChange={(event) => setStatusCode(event.target.value)}
              />
            </FormField>
          </div>

          <Button
            isLoading={isSavingRedirect}
            loadingLabel="Saving"
            onClick={() => void onSaveRedirect()}
          >
            Add this redirect
          </Button>

          {redirects.length === 0 ? (
            <p className="text-sm text-muted-foreground">No address has moved yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Old address</TableHead>
                  <TableHead>Goes to</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead isNumeric>Used</TableHead>
                  <TableHead>Last used</TableHead>
                  <TableHead>State</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {redirects.map((redirect) => (
                  <TableRow key={redirect.redirectId}>
                    <TableCell className="break-all">{redirect.sourcePath}</TableCell>
                    <TableCell className="break-all">{redirect.targetPath}</TableCell>
                    <TableCell>{redirect.statusCode === 301 ? 'Permanent' : 'Temporary'}</TableCell>
                    <TableCell isNumeric>{formatNumber(redirect.hitCount)}</TableCell>
                    <TableCell>
                      {redirect.lastHitAt === null ? 'Never' : formatDateTime(redirect.lastHitAt)}
                    </TableCell>
                    <TableCell>
                      {redirect.isActive ? (
                        <Button
                          variant="ghost"
                          onClick={() => void onRemoveRedirect(redirect.redirectId)}
                        >
                          Retire
                        </Button>
                      ) : (
                        <Badge tone="neutral">Retired</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
