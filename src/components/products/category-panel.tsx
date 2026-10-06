// src/components/products/category-panel.tsx
// The categories beside the catalogue. A category can be added without leaving
// the page, and choosing one filters the list.

'use client';

import { FolderPlus } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { notify } from '@/components/ui/toaster';
import { createProductCategory } from '@/features/products/actions/create-category';
import type { ProductCategoryRecord } from '@/features/products/types';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface CategoryPanelProps {
  /** Categories this company has, with their item counts. */
  categories: readonly ProductCategoryRecord[];
  /** Category currently filtered on, when there is one. */
  activeCategoryId: string | null;
  /** False when the signed in account may not add a category. */
  canCreate: boolean;
}

/**
 * Renders the category panel beside the catalogue.
 *
 * @param props The categories and what the account may do.
 * @returns The rendered panel.
 */
export function CategoryPanel({ categories, activeCategoryId, canCreate }: CategoryPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  /**
   * Filters the catalogue by one category.
   *
   * @param categoryId Category to filter on, or null for all of them.
   * @returns Nothing.
   */
  function filterBy(categoryId: string | null): void {
    const next = new URLSearchParams(searchParams.toString());

    if (categoryId === null) {
      next.delete('category');
    } else {
      next.set('category', categoryId);
    }

    next.delete('page');
    const query = next.toString();
    router.push(query.length > 0 ? `${pathname}?${query}` : pathname);
  }

  /**
   * Adds a category from the small form at the bottom of the panel.
   *
   * @param event Submit event from the form.
   * @returns Nothing.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSubmitting(true);
    setFieldErrors({});

    const result = await createProductCategory({ name });
    setIsSubmitting(false);

    if (!result.success) {
      setFieldErrors(result.fieldErrors ?? {});
      notify.error(result.error);
      return;
    }

    setName('');
    notify.success('Category added.');
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Categories</CardTitle>
        <CardDescription>Group the catalogue so a long list stays easy to search.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-1">
          <li>
            <button
              type="button"
              onClick={() => {
                filterBy(null);
              }}
              className={cn(
                'flex min-h-touch w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-surface-muted',
                activeCategoryId === null ? 'bg-surface-muted font-medium text-foreground' : ''
              )}
            >
              <span>All items</span>
            </button>
          </li>
          {categories.map((category) => (
            <li key={category.id}>
              <button
                type="button"
                onClick={() => {
                  filterBy(category.id);
                }}
                className={cn(
                  'flex min-h-touch w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-surface-muted',
                  activeCategoryId === category.id
                    ? 'bg-surface-muted font-medium text-foreground'
                    : ''
                )}
              >
                <span className="truncate">{category.name}</span>
                <span className="tabular text-xs text-muted-foreground">
                  {formatNumber(category.productCount)}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No categories yet. Add one below and it becomes a filter straight away.
          </p>
        ) : null}

        {canCreate ? (
          <form
            noValidate
            onSubmit={(event) => {
              void handleSubmit(event);
            }}
            className="space-y-3 border-t border-border pt-4"
          >
            <FormField id="category-name" label="New category" errors={fieldErrors['name']}>
              <Input
                {...fieldAccessibilityProps('category-name', false, Boolean(fieldErrors['name']))}
                name="name"
                value={name}
                disabled={isSubmitting}
                onChange={(event) => {
                  setName(event.target.value);
                }}
              />
            </FormField>
            <Button
              type="submit"
              variant="secondary"
              fullWidth
              isLoading={isSubmitting}
              loadingLabel="Adding"
              leadingIcon={<FolderPlus aria-hidden="true" className="h-4 w-4" />}
              disabled={name.trim().length === 0}
            >
              Add category
            </Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
