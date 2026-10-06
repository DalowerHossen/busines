// src/app/api/payouts/statement/route.ts
// Downloading the wallet statement as a PDF, so a business can hand the same
// figures to its accountant without retyping anything.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { loadPayoutOverview } from '@/features/payouts/queries/get-wallet';
import { recordAuditEntry } from '@/lib/audit/record';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { formatDateTime, todayIso } from '@/lib/dates';
import { buildTablePdf } from '@/lib/export/pdf';
import { formatMoney, humanise } from '@/lib/format';
import { errorResponse, HTTP_STATUS } from '@/lib/http/responses';

export const dynamic = 'force-dynamic';

/**
 * Answers a statement download request.
 *
 * @param _request Incoming request.
 * @returns The PDF, or an explanation in the usual shape.
 */
export async function GET(_request: NextRequest): Promise<NextResponse> {
  const user = await getSessionUser();

  if (!user) {
    return errorResponse(
      'Sign in to download your statement.',
      HTTP_STATUS.unauthorised,
      'unauthenticated'
    );
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return errorResponse(
      'This account is not attached to a business.',
      HTTP_STATUS.forbidden,
      'forbidden'
    );
  }

  if (!can(user, 'payments', 'view')) {
    return errorResponse(
      'You do not have permission to see this balance.',
      HTTP_STATUS.forbidden,
      'forbidden'
    );
  }

  const overview = await loadPayoutOverview(company.id);

  if (overview.wallet === null) {
    return errorResponse(
      'There is no wallet for this business yet.',
      HTTP_STATUS.notFound,
      'not_found'
    );
  }

  const wallet = overview.wallet;
  const entries = [...overview.entries].reverse();

  const file = buildTablePdf({
    title: 'Wallet statement',
    subtitles: [
      company.legalName || company.displayName,
      `Prepared ${formatDateTime(new Date().toISOString())}`,
      `Ready to send ${formatMoney(wallet.availableBalance, wallet.currency)} · still clearing ${formatMoney(
        wallet.pendingBalance,
        wallet.currency
      )} · on its way ${formatMoney(wallet.reservedBalance, wallet.currency)}`,
    ],
    headers: ['Date', 'Description', 'Kind', 'Amount', 'Balance after'],
    rows: entries.map((entry) => [
      formatDateTime(entry.occurredAt),
      entry.description,
      humanise(entry.transactionType),
      formatMoney(entry.amount, entry.currency),
      formatMoney(entry.balanceAfter, entry.currency),
    ]),
    totalRow: [
      'TOTAL',
      'Balance available to send',
      '',
      '',
      formatMoney(wallet.availableBalance, wallet.currency),
    ],
    numericColumns: [3, 4],
    footerNote:
      'Money is held for a short window after each payment so a refund can still be taken from it.',
  });

  await recordAuditEntry({
    action: 'export',
    entityType: 'wallet',
    entityId: wallet.id,
    companyId: company.id,
    description: 'Wallet statement downloaded.',
  });

  return new NextResponse(Buffer.from(file), {
    status: HTTP_STATUS.ok,
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="wallet-statement-${todayIso()}.pdf"`,
      'cache-control': 'no-store',
      'referrer-policy': 'no-referrer',
    },
  });
}
