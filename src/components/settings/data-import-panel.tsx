// src/components/settings/data-import-panel.tsx
// Bringing a business in from whatever it used before.
//
// The rehearsal is not optional and it is not hidden behind a setting. A
// person drops in the file they exported, sees precisely what would be
// created, what is already here and which rows cannot be used, and only
// then chooses to run it. An import that surprises somebody is an import
// that gets undone by hand for a week.

'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { notify } from '@/components/ui/toaster';
import { runDataImport, type RunImportResult } from '@/features/imports/actions/run-import';
import type { ImportRun } from '@/features/imports/queries/get-imports';
import { formatDateTime } from '@/lib/dates';
import { formatNumber, humanise } from '@/lib/format';

export interface DataImportPanelProps {
  /** What has been brought in before. */
  runs: readonly ImportRun[];
  /** True when the viewer may import. */
  canImport: boolean;
}

const COLUMN_GUIDE: Readonly<Record<string, string>> = {
  clients: 'display_name, email, phone, legal_name, payment_terms_days',
  products: 'name, sku, unit_price, description, product_type',
};

/**
 * Renders the import panel.
 *
 * @param props The history and whether the viewer may import.
 * @returns The rendered panel.
 */
export function DataImportPanel({ runs, canImport }: DataImportPanelProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [importKind, setImportKind] = useState<'clients' | 'products'>('clients');
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileText, setFileText] = useState('');
  const [isWorking, setIsWorking] = useState(false);
  const [preview, setPreview] = useState<RunImportResult | null>(null);

  /**
   * Reads the chosen file into memory.
   *
   * @param file File the person chose.
   * @returns Nothing.
   */
  async function onChoose(file: File): Promise<void> {
    setFileName(file.name);
    setPreview(null);
    setFileText(await file.text());
  }

  /**
   * Runs the import, as a rehearsal or for real.
   *
   * @param isDryRun True to change nothing.
   * @returns Nothing.
   */
  async function onRun(isDryRun: boolean): Promise<void> {
    if (fileText === '') {
      notify.error('Choose the file you exported first.');

      return;
    }

    setIsWorking(true);

    const result = await runDataImport({
      importKind,
      fileText,
      sourceLabel: fileName ?? undefined,
      isDryRun,
    });

    setIsWorking(false);

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    setPreview(result.data);

    if (isDryRun) {
      notify.success('Nothing was changed. This is what would happen.');
    } else {
      notify.success(`Brought in ${formatNumber(result.data.createdCount)} records.`);
      setFileText('');
      setFileName(null);

      if (inputRef.current !== null) {
        inputRef.current.value = '';
      }

      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Bring your records in</CardTitle>
          <CardDescription>
            Export a spreadsheet from whatever you used before and drop it here. Nothing is written
            until you have seen what would happen.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="import-kind" label="What are you bringing in">
              <Select
                id="import-kind"
                value={importKind}
                options={[
                  { value: 'clients', label: 'Clients' },
                  { value: 'products', label: 'Products and services' },
                ]}
                onChange={(event) => {
                  setImportKind(event.target.value === 'products' ? 'products' : 'clients');
                  setPreview(null);
                }}
              />
            </FormField>

            <FormField
              id="import-file"
              label="The file"
              hint={`The first line should name the columns. We look for ${COLUMN_GUIDE[importKind] ?? ''}.`}
              isRequired
            >
              <input
                id="import-file"
                ref={inputRef}
                type="file"
                accept=".csv,.tsv,.txt,text/csv,text/plain"
                className="min-h-touch w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                onChange={(event) => {
                  const chosen = event.target.files?.[0] ?? null;

                  if (chosen !== null) {
                    void onChoose(chosen);
                  }
                }}
              />
            </FormField>
          </div>

          {canImport ? (
            <div className="flex flex-wrap gap-2">
              <Button
                isLoading={isWorking}
                loadingLabel="Checking"
                onClick={() => void onRun(true)}
              >
                Show me what would happen
              </Button>

              {preview === null || !preview.isDryRun ? null : (
                <Button variant="secondary" onClick={() => void onRun(false)}>
                  {`Bring in ${formatNumber(preview.createdCount)} records`}
                </Button>
              )}
            </div>
          ) : (
            <Alert tone="info" title="You are looking, not importing">
              Ask the owner of this business to give your account permission to add records.
            </Alert>
          )}

          {preview === null ? null : (
            <div className="space-y-3 rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={preview.isDryRun ? 'warning' : 'success'}>
                  {preview.isDryRun ? 'Rehearsal, nothing written' : 'Brought in'}
                </Badge>
                <span className="tabular text-sm text-muted-foreground">
                  {`${formatNumber(preview.rowCount)} rows read`}
                </span>
              </div>

              <dl className="grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground">
                    {preview.isDryRun ? 'Would be created' : 'Created'}
                  </dt>
                  <dd className="tabular text-lg font-semibold">
                    {formatNumber(preview.createdCount)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Already here</dt>
                  <dd className="tabular text-lg font-semibold">
                    {formatNumber(preview.matchedCount)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Cannot be used</dt>
                  <dd className="tabular text-lg font-semibold">
                    {formatNumber(preview.skippedCount)}
                  </dd>
                </div>
              </dl>

              {preview.headers.length === 0 ? null : (
                <p className="text-sm text-muted-foreground">
                  {`Columns found: ${preview.headers.join(', ')}.`}
                </p>
              )}

              {preview.fileProblem === null ? null : (
                <Alert tone="warning" title="About the file">
                  {preview.fileProblem}
                </Alert>
              )}

              {preview.problems.length === 0 ? null : (
                <div>
                  <p className="text-sm font-medium text-foreground">Rows that cannot be used</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {preview.problems.slice(0, 20).map((problem) => (
                      <li key={`${String(problem.row)}-${problem.problem}`}>
                        {`Row ${formatNumber(problem.row)}: ${problem.problem}`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <Alert tone="info" title="A record that is already here is left alone">
            We match on the email address, and on the name when there is no email. Running the same
            file twice brings nothing in a second time, so there is no harm in being careful.
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What you have brought in</CardTitle>
          <CardDescription>
            Rehearsals are kept as well, so you can see what was tried before it was done.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing has been imported yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>What</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead isNumeric>Rows</TableHead>
                  <TableHead isNumeric>Created</TableHead>
                  <TableHead isNumeric>Already here</TableHead>
                  <TableHead>Kind of run</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.batchId}>
                    <TableCell>{formatDateTime(run.startedAt)}</TableCell>
                    <TableCell>{humanise(run.importKind)}</TableCell>
                    <TableCell>{run.sourceLabel ?? 'Not named'}</TableCell>
                    <TableCell isNumeric>{formatNumber(run.rowCount)}</TableCell>
                    <TableCell isNumeric>{formatNumber(run.createdCount)}</TableCell>
                    <TableCell isNumeric>{formatNumber(run.matchedCount)}</TableCell>
                    <TableCell>
                      <Badge tone={run.isDryRun ? 'neutral' : 'success'}>
                        {run.isDryRun ? 'Rehearsal' : 'Real'}
                      </Badge>
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
