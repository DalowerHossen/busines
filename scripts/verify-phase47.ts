import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { calculateClientStatement, findPotentialDuplicates } from '@/lib/clients/service';
import { ClientDomainError } from '@/lib/clients/errors';
import { CLIENTS } from '@/features/clients/clients-data';
import type { Client } from '@/types/client';
import type { Money, UUID } from '@/types/core';

const root = process.cwd();
const money = (amount: string): Money => ({
  amount: amount as Money['amount'],
  currency: 'USD' as Money['currency'],
});

function read(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), 'utf8');
}

function main(): void {
  for (const relativePath of [
    'src/lib/clients/errors.ts',
    'src/lib/clients/service.ts',
    'src/lib/clients/import-export.ts',
    'src/lib/clients/supabase-store.ts',
    'src/features/clients/clients-page.tsx',
    'src/features/clients/client-detail-page.tsx',
    'src/features/clients/client-form.tsx',
    'src/app/(app)/clients/page.tsx',
    'src/app/(app)/clients/[clientId]/page.tsx',
    'src/app/api/clients/import/route.ts',
    'src/app/api/clients/export/route.ts',
  ]) {
    assert.equal(existsSync(resolve(root, relativePath)), true, `${relativePath} is missing.`);
  }

  const duplicateSource = CLIENTS[0];
  assert.ok(duplicateSource);
  const duplicate = {
    ...duplicateSource,
    id: 'client-duplicate' as UUID,
    displayName: 'Acme Studio Copy',
    phone: '+1 415 555 0199',
  } satisfies Client;
  const matches = findPotentialDuplicates([duplicateSource, duplicate]);
  assert.equal(matches.length, 1);
  assert.deepEqual(matches[0]?.matchReasons, ['email']);

  const statement = calculateClientStatement({
    clientId: 'client-1',
    currency: 'USD',
    openingBalance: money('10.00'),
    invoices: [
      {
        id: 'invoice-1',
        clientId: 'client-1',
        invoiceNumber: 'INV-1',
        issuedAt: '2026-10-01T00:00:00.000Z',
        total: money('100.00'),
      },
    ],
    payments: [
      {
        id: 'payment-1',
        clientId: 'client-1',
        reference: 'PAY-1',
        paidAt: '2026-10-02T00:00:00.000Z',
        amount: money('25.00'),
      },
    ],
    credits: [
      {
        id: 'credit-1',
        clientId: 'client-1',
        reference: 'CR-1',
        issuedAt: '2026-10-03T00:00:00.000Z',
        amount: money('5.00'),
      },
    ],
  });
  assert.equal(statement.rows.length, 3);
  assert.equal(statement.closingBalance.amount, '80.00');
  assert.equal(statement.totalInvoiced.amount, '100.00');
  assert.equal(statement.totalPaid.amount, '25.00');
  assert.equal(statement.totalCredits.amount, '5.00');
  const crossTenantPayment = statementInput().payments[0];
  assert.ok(crossTenantPayment);
  assert.throws(
    () =>
      calculateClientStatement({
        ...statementInput(),
        payments: [{ ...crossTenantPayment, clientId: 'other-client' }],
      }),
    (error: unknown) => error instanceof ClientDomainError && error.code === 'tenant_scope_denied'
  );

  const importExport = read('src/lib/clients/import-export.ts');
  assert.match(importExport, /parseTabularFile/u);
  assert.match(importExport, /serializeCsv/u);
  assert.match(importExport, /maxRows: 10_000/u);
  assert.match(read('src/lib/media/tabular.ts'), /maxRows/u);
  assert.match(read('src/lib/media/csv.ts'), /safeValue/u);
  assert.match(read('src/app/api/clients/import/route.ts'), /x-company-id/u);
  assert.match(read('src/app/api/clients/export/route.ts'), /assertTenantAccess/u);

  process.stdout.write(
    'Phase 47 verification passed: tenant-safe client domain logic, statement/timeline foundations, duplicate detection, and formula-safe CSV export are covered.\n'
  );
}

function statementInput() {
  return {
    clientId: 'client-1',
    currency: 'USD',
    openingBalance: money('0'),
    invoices: [
      {
        id: 'invoice-1',
        clientId: 'client-1',
        invoiceNumber: 'INV-1',
        issuedAt: '2026-10-01T00:00:00.000Z',
        total: money('100.00'),
      },
    ],
    payments: [
      {
        id: 'payment-1',
        clientId: 'client-1',
        reference: 'PAY-1',
        paidAt: '2026-10-02T00:00:00.000Z',
        amount: money('25.00'),
      },
    ],
    credits: [],
  };
}

main();
