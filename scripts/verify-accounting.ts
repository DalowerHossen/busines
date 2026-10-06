import assert from 'node:assert/strict';
import {
  calculateBalanceSheet,
  calculateCashFlow,
  calculateProfitAndLoss,
} from '@/lib/accounting/statements';
import { extractReceiptFields } from '@/lib/accounting/ocr';
import {
  chooseBankMatch,
  reconcileBankTransaction,
  suggestBankMatches,
} from '@/lib/accounting/reconciliation';
import { validateJournalEntry } from '@/lib/accounting/journal';
import type {
  AccountingAccount,
  BankMatchCandidate,
  JournalEntryInput,
  PostedJournalEntry,
  ReceiptOcrResult,
} from '@/lib/accounting';

const companyId = 'company-1';
const accounts: readonly AccountingAccount[] = [
  {
    id: 'cash',
    companyId,
    accountCode: '1000',
    accountName: 'Cash',
    accountType: 'asset',
    isActive: true,
  },
  {
    id: 'revenue',
    companyId,
    accountCode: '4000',
    accountName: 'Sales',
    accountType: 'revenue',
    isActive: true,
  },
  {
    id: 'cogs',
    companyId,
    accountCode: '5000',
    accountName: 'Cost of goods sold',
    accountType: 'expense',
    isActive: true,
  },
  {
    id: 'operating',
    companyId,
    accountCode: '6000',
    accountName: 'Operating expense',
    accountType: 'expense',
    isActive: true,
  },
  {
    id: 'equity',
    companyId,
    accountCode: '3000',
    accountName: 'Owner equity',
    accountType: 'equity',
    isActive: true,
  },
];

function entry(
  input: Omit<JournalEntryInput, 'companyId' | 'currencyCode' | 'createdByUserId'>
): PostedJournalEntry {
  return validateJournalEntry({
    entry: {
      ...input,
      companyId,
      currencyCode: 'USD',
      createdByUserId: 'owner-1',
    },
    accounts,
    periods: [{ startDate: '2026-01-01', endDate: '2026-12-31', isLocked: false }],
  });
}

async function main(): Promise<void> {
  const entries = [
    entry({
      entryDate: '2026-10-01',
      description: 'Cash sale',
      lines: [
        { accountId: 'cash', debitAmount: '100.00', creditAmount: '0' },
        { accountId: 'revenue', debitAmount: '0', creditAmount: '100.00' },
      ],
    }),
    entry({
      entryDate: '2026-10-02',
      description: 'Cost of sale',
      lines: [
        { accountId: 'cogs', debitAmount: '30.00', creditAmount: '0' },
        { accountId: 'cash', debitAmount: '0', creditAmount: '30.00' },
      ],
    }),
    entry({
      entryDate: '2026-10-03',
      description: 'Operating expense payment',
      lines: [
        { accountId: 'operating', debitAmount: '20.00', creditAmount: '0' },
        { accountId: 'cash', debitAmount: '0', creditAmount: '20.00' },
      ],
    }),
    entry({
      entryDate: '2026-10-04',
      description: 'Owner contribution',
      lines: [
        { accountId: 'cash', debitAmount: '50.00', creditAmount: '0' },
        { accountId: 'equity', debitAmount: '0', creditAmount: '50.00' },
      ],
    }),
  ];

  assert.equal(
    calculateProfitAndLoss({
      companyId,
      currencyCode: 'USD',
      period: { startDate: '2026-10-01', endDate: '2026-10-31' },
      entries,
      accounts,
      cogsAccountIds: new Set(['cogs']),
    }).netProfit,
    '50.0000'
  );
  const balanceSheet = calculateBalanceSheet({
    companyId,
    currencyCode: 'USD',
    asOfDate: '2026-10-31',
    profitAndLossPeriod: { startDate: '2026-10-01', endDate: '2026-10-31' },
    entries,
    accounts,
  });
  assert.equal(balanceSheet.totalAssets, '100.0000');
  assert.equal(balanceSheet.totalLiabilitiesAndEquity, '100.0000');
  assert.equal(balanceSheet.isBalanced, true);
  const cashFlow = calculateCashFlow({
    companyId,
    currencyCode: 'USD',
    period: { startDate: '2026-10-01', endDate: '2026-10-31' },
    entries,
    cashAccountIds: new Set(['cash']),
    categoryByCounterpartAccountId: {
      revenue: 'operating',
      cogs: 'operating',
      operating: 'operating',
      equity: 'financing',
    },
    openingCashBalance: '0',
  });
  assert.equal(cashFlow.operating, '50.0000');
  assert.equal(cashFlow.financing, '50.0000');
  assert.equal(cashFlow.closingCashBalance, '100.0000');

  assert.throws(() =>
    validateJournalEntry({
      entry: {
        companyId,
        currencyCode: 'USD',
        entryDate: '2026-10-05',
        description: 'Unbalanced entry',
        createdByUserId: 'owner-1',
        lines: [{ accountId: 'cash', debitAmount: '10', creditAmount: '0' }],
      },
      accounts,
      periods: [],
    })
  );
  assert.throws(() =>
    validateJournalEntry({
      entry: {
        companyId,
        currencyCode: 'USD',
        entryDate: '2026-10-05',
        description: 'Locked period entry',
        createdByUserId: 'owner-1',
        lines: [
          { accountId: 'cash', debitAmount: '10', creditAmount: '0' },
          { accountId: 'revenue', debitAmount: '0', creditAmount: '10' },
        ],
      },
      accounts,
      periods: [{ startDate: '2026-10-01', endDate: '2026-10-31', isLocked: true }],
    })
  );

  const candidates: readonly BankMatchCandidate[] = [
    {
      id: 'payment-1',
      companyId,
      candidateType: 'payment',
      transactionDate: '2026-10-06',
      description: 'Client payment INV-100',
      amount: '100.00',
    },
    {
      id: 'payment-2',
      companyId,
      candidateType: 'payment',
      transactionDate: '2026-10-06',
      description: 'Different payment',
      amount: '100.00',
    },
  ];
  const suggestions = suggestBankMatches({
    transaction: {
      id: 'bank-1',
      companyId,
      transactionDate: '2026-10-06',
      description: 'Client payment INV-100',
      amount: '100.00',
      isReconciled: false,
    },
    candidates,
    rules: [],
    minimumConfidence: 0.8,
  });
  assert.equal(chooseBankMatch({ suggestions, minimumConfidence: 0.8 })?.candidate.id, 'payment-1');
  const firstCandidate = candidates[0];
  assert.ok(firstCandidate);
  const reconciliation = await reconcileBankTransaction({
    transaction: {
      id: 'bank-1',
      companyId,
      transactionDate: '2026-10-06',
      description: 'Client payment INV-100',
      amount: '100.00',
      isReconciled: false,
    },
    candidate: firstCandidate,
    reconciledByUserId: 'owner-1',
    reconciledAt: '2026-10-06T12:00:00Z',
    store: {
      async persist(input) {
        return input;
      },
    },
  });
  assert.equal(reconciliation.status, 'reconciled');

  const ocrResult: ReceiptOcrResult = {
    providerId: 'ocr-adapter',
    providerRequestId: 'ocr-request-1',
    vendorName: 'Office Supplies',
    receiptDate: '2026-10-05',
    currencyCode: 'USD',
    subtotalAmount: '10.00',
    taxAmount: '1.50',
    totalAmount: '11.50',
    confidence: '0.95',
    lineItems: [{ description: 'Paper', quantity: '1', unitPrice: '10.00', total: '10.00' }],
  };
  const stored = new Map<string, ReceiptOcrResult>();
  const ocrRequest = {
    companyId,
    providerFileId: 'receipt-file-1',
    mimeType: 'application/pdf' as const,
    sizeBytes: 1024,
    contentSha256: 'a'.repeat(64),
    requestedByUserId: 'owner-1',
  };
  const firstOcr = await extractReceiptFields({
    request: ocrRequest,
    adapter: {
      providerId: 'ocr-adapter',
      async extract() {
        return ocrResult;
      },
    },
    store: {
      async findByContentHash(input) {
        return stored.get(`${input.companyId}:${input.contentSha256}`) ?? null;
      },
      async create(input) {
        stored.set(`${input.request.companyId}:${input.request.contentSha256}`, input.result);
        return input.result;
      },
    },
  });
  assert.equal(firstOcr.duplicate, false);
  const secondOcr = await extractReceiptFields({
    request: ocrRequest,
    adapter: {
      providerId: 'ocr-adapter',
      async extract() {
        throw new Error('Must not call OCR twice.');
      },
    },
    store: {
      async findByContentHash(input) {
        return stored.get(`${input.companyId}:${input.contentSha256}`) ?? null;
      },
      async create(input) {
        return input.result;
      },
    },
  });
  assert.equal(secondOcr.duplicate, true);

  process.stdout.write('Accounting, statements, reconciliation, and OCR smoke test passed.\n');
}

main().catch((error: unknown) => {
  process.stderr.write(
    error instanceof Error ? `${error.message}\n` : 'Accounting smoke test failed.\n'
  );
  process.exitCode = 1;
});
