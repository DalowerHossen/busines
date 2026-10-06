// src/components/reports/books-console.tsx
// The books themselves: the accounts, what has been posted, and whether the
// two sides still agree.
//
// A posted entry is never edited here, only reversed. The mistake and the
// correction both stay visible, which is the difference between bookkeeping
// and a spreadsheet somebody has been tidying.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
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
import {
  postJournalEntry,
  reverseJournalEntry,
  saveLedgerAccount,
} from '@/features/accounting/actions/manage-books';
import type {
  JournalEntryRow,
  LedgerAccountRow,
  TrialBalanceRow,
} from '@/features/accounting/types';
import { ACCOUNT_TYPES } from '@/features/accounting/validation/accounting';
import { formatDate, todayIso } from '@/lib/dates';
import { formatMoney, humanise } from '@/lib/format';

export interface BooksConsoleProps {
  /** The chart of accounts. */
  accounts: readonly LedgerAccountRow[];
  /** What has been posted recently. */
  entries: readonly JournalEntryRow[];
  /** The trial balance as it stands. */
  trialBalance: readonly TrialBalanceRow[];
  /** Everything debited. */
  totalDebit: string;
  /** Everything credited. */
  totalCredit: string;
  /** True when the two sides agree. */
  isBalanced: boolean;
  /** True when the viewer may post entries. */
  canEdit: boolean;
  /** Currency this business keeps its books in. */
  currency: string;
}

type AccountType = (typeof ACCOUNT_TYPES)[number];

interface DraftLine {
  accountId: string;
  debit: string;
  credit: string;
}

const EMPTY_LINE: DraftLine = { accountId: '', debit: '0', credit: '0' };

/**
 * Renders the accounting console.
 *
 * @param props The books and who may write in them.
 * @returns The rendered console.
 */
export function BooksConsole({
  accounts,
  entries,
  trialBalance,
  totalDebit,
  totalCredit,
  isBalanced,
  canEdit,
  currency,
}: BooksConsoleProps) {
  const router = useRouter();

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('expense');
  const [isSavingAccount, setIsSavingAccount] = useState(false);

  const [entryDate, setEntryDate] = useState(todayIso());
  const [memo, setMemo] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([{ ...EMPTY_LINE }, { ...EMPTY_LINE }]);
  const [isPosting, setIsPosting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const [reversingId, setReversingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const draftDebit = lines.reduce(
    (running, line) => running + Number.parseFloat(line.debit || '0'),
    0
  );
  const draftCredit = lines.reduce(
    (running, line) => running + Number.parseFloat(line.credit || '0'),
    0
  );
  const difference = draftDebit - draftCredit;

  /**
   * Opens a new account in the chart.
   *
   * @returns Nothing.
   */
  async function onSaveAccount(): Promise<void> {
    setIsSavingAccount(true);
    const result = await saveLedgerAccount({ code, name, accountType });
    setIsSavingAccount(false);

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success('Opened.');
    setCode('');
    setName('');
    router.refresh();
  }

  /**
   * Posts the entry that is on screen.
   *
   * @returns Nothing.
   */
  async function onPost(): Promise<void> {
    setIsPosting(true);
    setFieldErrors({});

    const result = await postJournalEntry({
      entryDate,
      memo,
      lines: lines.map((line) => ({
        accountId: line.accountId,
        debit: line.debit === '' ? '0' : line.debit,
        credit: line.credit === '' ? '0' : line.credit,
      })),
    });

    setIsPosting(false);

    if (!result.success) {
      setFieldErrors(result.fieldErrors ?? {});
      notify.error(result.error);

      return;
    }

    notify.success('Posted. It can be reversed but never edited.');
    setMemo('');
    setLines([{ ...EMPTY_LINE }, { ...EMPTY_LINE }]);
    router.refresh();
  }

  /**
   * Reverses one posted entry.
   *
   * @param entryId Entry being undone.
   * @returns Nothing.
   */
  async function onReverse(entryId: string): Promise<void> {
    const result = await reverseJournalEntry({ entryId, reason });

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success('Reversed. Both the original and the correction stay on the record.');
    setReversingId(null);
    setReason('');
    router.refresh();
  }

  const accountOptions = [
    { value: '', label: 'Choose an account' },
    ...accounts
      .filter((account) => account.isActive)
      .map((account) => ({
        value: account.accountId,
        label: `${account.code} ${account.name}`,
      })),
  ];

  return (
    <div className="space-y-6">
      {isBalanced ? null : (
        <Alert tone="danger" title="The books do not balance">
          {`Debits come to ${formatMoney(totalDebit, currency)} and credits to ${formatMoney(
            totalCredit,
            currency
          )}. Something has been posted outside the normal routes. Do not file anything from these figures until it is found.`}
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Trial balance</CardTitle>
              <CardDescription>
                Every account, and the two totals that have to agree.
              </CardDescription>
            </div>
            <Badge tone={isBalanced ? 'success' : 'danger'}>
              {isBalanced ? 'In balance' : 'Out of balance'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {trialBalance.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing has been posted yet. Raise an invoice or record an expense and the entries
              appear here by themselves.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead isNumeric>Debit</TableHead>
                  <TableHead isNumeric>Credit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trialBalance.map((row) => (
                  <TableRow key={row.accountCode}>
                    <TableCell>{row.accountCode}</TableCell>
                    <TableCell>{row.accountName}</TableCell>
                    <TableCell>{humanise(row.accountType)}</TableCell>
                    <TableCell isNumeric>{formatMoney(row.debitTotal, currency)}</TableCell>
                    <TableCell isNumeric>{formatMoney(row.creditTotal, currency)}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={3}>TOTAL</TableCell>
                  <TableCell isNumeric>{formatMoney(totalDebit, currency)}</TableCell>
                  <TableCell isNumeric>{formatMoney(totalCredit, currency)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {canEdit ? (
        <Card>
          <CardHeader>
            <CardTitle>Post an entry by hand</CardTitle>
            <CardDescription>
              For the things no invoice or expense produces: an opening balance, a correction, a
              depreciation. The two sides have to agree before it will save.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField id="entry-date" label="Date" isRequired>
                <Input
                  id="entry-date"
                  type="date"
                  value={entryDate}
                  onChange={(event) => setEntryDate(event.target.value)}
                />
              </FormField>

              <div className="sm:col-span-2">
                <FormField
                  id="entry-memo"
                  label="What this entry is for"
                  errors={fieldErrors['memo']}
                  isRequired
                >
                  <Input
                    id="entry-memo"
                    value={memo}
                    onChange={(event) => setMemo(event.target.value)}
                  />
                </FormField>
              </div>
            </div>

            <div className="space-y-3">
              {lines.map((line, index) => (
                <div
                  key={`line-${String(index)}`}
                  className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]"
                >
                  <FormField id={`line-account-${String(index)}`} label="Account">
                    <Select
                      id={`line-account-${String(index)}`}
                      value={line.accountId}
                      options={accountOptions}
                      onChange={(event) => {
                        const next = [...lines];
                        next[index] = { ...line, accountId: event.target.value };
                        setLines(next);
                      }}
                    />
                  </FormField>

                  <FormField id={`line-debit-${String(index)}`} label={`Debit (${currency})`}>
                    <Input
                      id={`line-debit-${String(index)}`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.debit}
                      onChange={(event) => {
                        const next = [...lines];
                        next[index] = { ...line, debit: event.target.value };
                        setLines(next);
                      }}
                    />
                  </FormField>

                  <FormField id={`line-credit-${String(index)}`} label={`Credit (${currency})`}>
                    <Input
                      id={`line-credit-${String(index)}`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.credit}
                      onChange={(event) => {
                        const next = [...lines];
                        next[index] = { ...line, credit: event.target.value };
                        setLines(next);
                      }}
                    />
                  </FormField>
                </div>
              ))}

              <Button variant="ghost" onClick={() => setLines([...lines, { ...EMPTY_LINE }])}>
                Add another line
              </Button>
            </div>

            <p
              className={
                Math.abs(difference) < 0.005
                  ? 'tabular text-sm text-muted-foreground'
                  : 'tabular text-sm font-medium text-warning'
              }
            >
              {Math.abs(difference) < 0.005
                ? `Balanced at ${formatMoney(draftDebit.toFixed(2), currency)} on each side.`
                : `Out by ${formatMoney(Math.abs(difference).toFixed(2), currency)}. Debits ${formatMoney(
                    draftDebit.toFixed(2),
                    currency
                  )}, credits ${formatMoney(draftCredit.toFixed(2), currency)}.`}
            </p>

            {fieldErrors['lines'] === undefined ? null : (
              <Alert tone="danger" title="This entry cannot be posted">
                {fieldErrors['lines'].join(' ')}
              </Alert>
            )}

            <Button isLoading={isPosting} loadingLabel="Posting" onClick={() => void onPost()}>
              Post this entry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Recent entries</CardTitle>
          <CardDescription>
            Everything posted, whether by hand or by an invoice, a payment or an expense.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing has been posted yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Number</TableHead>
                  <TableHead>What it was</TableHead>
                  <TableHead>Where it came from</TableHead>
                  <TableHead isNumeric>Amount</TableHead>
                  <TableHead>State</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.entryId}>
                    <TableCell>{formatDate(entry.entryDate)}</TableCell>
                    <TableCell>{entry.entryNumber ?? 'Not numbered'}</TableCell>
                    <TableCell>{entry.memo ?? 'No note'}</TableCell>
                    <TableCell>{humanise(entry.sourceType)}</TableCell>
                    <TableCell isNumeric>{formatMoney(entry.totalDebit, currency)}</TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        {entry.isReversal ? (
                          <Badge tone="neutral">Reversal</Badge>
                        ) : (
                          <Badge tone={entry.isPosted ? 'success' : 'warning'}>
                            {entry.isPosted ? 'Posted' : 'Draft'}
                          </Badge>
                        )}

                        {canEdit && entry.isPosted && !entry.isReversal ? (
                          <Button
                            variant="ghost"
                            onClick={() =>
                              setReversingId(reversingId === entry.entryId ? null : entry.entryId)
                            }
                          >
                            {reversingId === entry.entryId ? 'Close' : 'Reverse it'}
                          </Button>
                        ) : null}

                        {reversingId === entry.entryId ? (
                          <div className="space-y-2">
                            <FormField id={`reason-${entry.entryId}`} label="Why" isRequired>
                              <Input
                                id={`reason-${entry.entryId}`}
                                value={reason}
                                onChange={(event) => setReason(event.target.value)}
                              />
                            </FormField>
                            <Button onClick={() => void onReverse(entry.entryId)}>
                              Reverse this entry
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Chart of accounts</CardTitle>
          <CardDescription>
            The accounts the system uses itself cannot be renamed away, because the postings it
            makes have to land somewhere predictable.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead isNumeric>Balance</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => (
                <TableRow key={account.accountId}>
                  <TableCell>{account.code}</TableCell>
                  <TableCell>{account.name}</TableCell>
                  <TableCell>{humanise(account.accountType)}</TableCell>
                  <TableCell isNumeric>{formatMoney(account.currentBalance, currency)}</TableCell>
                  <TableCell>
                    {account.isSystem ? (
                      <Badge tone="neutral">Used by the system</Badge>
                    ) : account.isActive ? (
                      ''
                    ) : (
                      <Badge tone="warning">Closed</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {canEdit ? (
            <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-4">
              <FormField id="account-code" label="Code" isRequired>
                <Input
                  id="account-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                />
              </FormField>

              <FormField id="account-name" label="Name" isRequired>
                <Input
                  id="account-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </FormField>

              <FormField id="account-type" label="Kind">
                <Select
                  id="account-type"
                  value={accountType}
                  options={ACCOUNT_TYPES.map((entry) => ({
                    value: entry,
                    label: humanise(entry),
                  }))}
                  onChange={(event) => setAccountType(event.target.value as AccountType)}
                />
              </FormField>

              <div className="flex items-end">
                <Button
                  variant="secondary"
                  isLoading={isSavingAccount}
                  loadingLabel="Opening"
                  onClick={() => void onSaveAccount()}
                >
                  Open this account
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
