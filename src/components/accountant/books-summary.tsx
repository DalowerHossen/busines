// src/components/accountant/books-summary.tsx
// The four figures an accountant checks before anything else: what the
// period earned, what it spent, what the result was, and whether the ledger
// still balances.

import { AlertTriangle, CheckCircle2, Coins, Receipt, Scale } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { CompanyBooks } from '@/features/accountants/types';
import { addMoney, subtractMoney } from '@/lib/money';
import { formatMoney } from '@/lib/format';

export interface BooksSummaryProps {
  /** The books being read. */
  books: CompanyBooks;
}

interface SummaryTile {
  key: string;
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
}

/**
 * Adds the amounts of one reporting section.
 *
 * @param books The books being read.
 * @param section Section name as the report returns it.
 * @returns The total as a decimal string.
 */
function sectionTotal(books: CompanyBooks, section: string): string {
  return books.profitAndLoss
    .filter((line) => line.section === section)
    .reduce((total, line) => addMoney(total, line.amount).toString(), '0');
}

/**
 * Renders the headline figures of one set of books.
 *
 * @param props The books being read.
 * @returns The rendered strip.
 */
export function BooksSummary({ books }: BooksSummaryProps) {
  const income = sectionTotal(books, 'Income');
  const costOfSales = sectionTotal(books, 'Cost of sales');
  const expenses = sectionTotal(books, 'Expenses');
  const spend = addMoney(costOfSales, expenses).toString();
  const result = subtractMoney(income, spend).toString();

  const tiles: SummaryTile[] = [
    {
      key: 'income',
      label: 'Income in the period',
      value: formatMoney(income, books.baseCurrency),
      hint: 'Everything credited to an income account',
      icon: Coins,
    },
    {
      key: 'spend',
      label: 'Cost and expenses',
      value: formatMoney(spend, books.baseCurrency),
      hint: `${formatMoney(costOfSales, books.baseCurrency)} of it is cost of sales`,
      icon: Receipt,
    },
    {
      key: 'result',
      label: 'Result',
      value: formatMoney(result, books.baseCurrency),
      hint: 'Income less cost of sales and expenses',
      icon: Scale,
    },
    {
      key: 'integrity',
      label: 'Ledger integrity',
      value: books.isBalanced ? 'In balance' : 'Out of balance',
      hint: books.isBalanced
        ? 'Every debit is answered by a credit'
        : 'Write to support before you file anything',
      icon: books.isBalanced ? CheckCircle2 : AlertTriangle,
    },
  ];

  return (
    <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {tiles.map((tile) => (
        <div key={tile.key} className="rounded-lg border border-border bg-surface p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-700">
              <tile.icon aria-hidden="true" className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <dt className="text-sm text-muted-foreground">{tile.label}</dt>
              <dd className="tabular truncate text-xl font-semibold text-foreground">
                {tile.value}
              </dd>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{tile.hint}</p>
        </div>
      ))}
    </dl>
  );
}
