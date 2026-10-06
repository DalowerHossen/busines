// src/features/products/queries/catalogue-references.ts
// The lists the catalogue form offers: categories, units of measure and tax
// rates. They are read together so the form opens in one round trip.

import type { CatalogueReference, CatalogueReferences } from '@/features/products/types';
import { logger } from '@/lib/logger';
import { asRows, readAmount, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * Reads the categories, units and tax rates of one company.
 *
 * @param companyId Company whose reference lists are read.
 * @returns The three lists, empty when they cannot be read.
 */
export async function loadCatalogueReferences(companyId: string): Promise<CatalogueReferences> {
  const supabase = createServerSupabaseClient();

  const [categories, units, taxRates] = await Promise.all([
    supabase
      .from('product_categories')
      .select('id, name')
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .is('archived_at', null)
      .order('name', { ascending: true }),
    supabase
      .from('units_of_measure')
      .select('id, name, abbreviation')
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .is('archived_at', null)
      .order('name', { ascending: true }),
    supabase
      .from('tax_rates')
      .select('id, name, rate_percentage')
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .is('archived_at', null)
      .order('name', { ascending: true }),
  ]);

  if (categories.error || units.error || taxRates.error) {
    logger.error(
      'Could not read the catalogue reference lists',
      categories.error ?? units.error ?? taxRates.error,
      { companyId }
    );
  }

  const toReference = (
    rows: unknown,
    label: (id: string, name: string, extra: string | null) => string,
    extraColumn: string
  ): CatalogueReference[] =>
    asRows(rows)
      .map((row) => {
        const id = readString(row, 'id');
        const name = readString(row, 'name');

        if (id === null || name === null) {
          return null;
        }

        const extra =
          extraColumn === 'rate_percentage'
            ? readAmount(row, extraColumn)
            : readString(row, extraColumn);

        return { id, label: label(id, name, extra) };
      })
      .filter((entry): entry is CatalogueReference => entry !== null);

  return {
    categories: toReference(categories.data, (_id, name) => name, 'name'),
    units: toReference(
      units.data,
      (_id, name, extra) => (extra === null ? name : `${name} (${extra})`),
      'abbreviation'
    ),
    taxRates: toReference(
      taxRates.data,
      (_id, name, extra) => (extra === null ? name : `${name} — ${extra}%`),
      'rate_percentage'
    ),
  };
}
