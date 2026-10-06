// src/components/marketing/plan-comparison.tsx
// The full comparison of what each plan includes, for the visitor who wants
// the detail rather than the headline.

import { Check, Minus } from 'lucide-react';
import { Fragment } from 'react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PLAN_COMPARISON, PLANS } from '@/config/plans';

export interface ComparisonValueProps {
  /** Value recorded for this plan, if the row has one. */
  value: string | boolean | undefined;
}

/**
 * Renders one cell of the comparison, as a tick, a dash or a short value.
 *
 * @param props Value recorded for this plan.
 * @returns The rendered cell content.
 */
function ComparisonValue({ value }: ComparisonValueProps) {
  if (value === true) {
    return (
      <>
        <Check aria-hidden="true" className="mx-auto h-4 w-4 text-success" />
        <span className="visually-hidden">Included</span>
      </>
    );
  }

  if (value === false || value === undefined) {
    return (
      <>
        <Minus aria-hidden="true" className="mx-auto h-4 w-4 text-muted-foreground" />
        <span className="visually-hidden">Not included</span>
      </>
    );
  }

  return <span className="text-sm text-foreground">{value}</span>;
}

/**
 * Renders the plan comparison table.
 *
 * @returns The rendered comparison.
 */
export function PlanComparison() {
  return (
    <Table caption="What each plan includes">
      <TableHeader>
        <TableRow>
          <TableHead className="w-[38%]">Included</TableHead>
          {PLANS.map((plan) => (
            <TableHead key={plan.key} className="text-center">
              {plan.name}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>

      <TableBody>
        {PLAN_COMPARISON.map((group) => (
          <Fragment key={group.title}>
            <TableRow className="bg-surface-muted">
              <TableCell
                colSpan={PLANS.length + 1}
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {group.title}
              </TableCell>
            </TableRow>

            {group.rows.map((row) => (
              <TableRow key={`${group.title}-${row.label}`}>
                <TableCell className="text-sm text-foreground">{row.label}</TableCell>
                {PLANS.map((plan) => (
                  <TableCell key={plan.key} className="text-center">
                    <ComparisonValue
                      value={(row.values as Record<string, string | boolean | undefined>)[plan.key]}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </Fragment>
        ))}
      </TableBody>
    </Table>
  );
}
