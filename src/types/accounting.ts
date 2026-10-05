// src/types/accounting.ts
// Expense, income, tax, chart-of-accounts, double-entry journal, supplier
// bill, and bank-feed domain types (FEATURE-REGISTRY.md groups P6.4-P6.5,
// P7, R4, R7.6, EE6). Added in the phase that implements their migrations;
// no earlier phase modeled any part of the accounting domain.
import type { ISODateString, Money, TenantScopedEntity, UUID } from '@/types/core';
import type { RecurringFrequency } from '@/types/invoice';

/**
 * A named grouping for expenses (for example "Software" or "Travel").
 */
export interface ExpenseCategory extends TenantScopedEntity {
  readonly name: string;
  readonly color: string | null;
  readonly isDefault: boolean;
}

/**
 * Lifecycle status of the optional expense approval flow (R7.6).
 */
export type ExpenseApprovalStatus = 'not_required' | 'pending' | 'approved' | 'rejected';

/**
 * A single recorded business expense. `rebillInvoiceId` is set once a
 * billable expense (AA7.8 reimbursable expense rebilling) has actually
 * been added to a client invoice.
 */
export interface Expense extends TenantScopedEntity {
  readonly categoryId: UUID | null;
  readonly vendorName: string | null;
  readonly description: string;
  readonly amount: Money;
  readonly expenseDate: ISODateString;
  readonly receiptProviderFileId: string | null;
  readonly isBillableToClient: boolean;
  readonly rebillClientId: UUID | null;
  readonly rebillInvoiceId: UUID | null;
  readonly approvalStatus: ExpenseApprovalStatus;
  readonly submittedByUserId: UUID;
  readonly approvedByUserId: UUID | null;
  readonly approvedAt: ISODateString | null;
}

/**
 * A recurring expense schedule that a scheduled job uses to create new
 * {@link Expense} records on a cadence, mirroring
 * `RecurringInvoiceTemplate` but for outgoing money instead of incoming.
 */
export interface RecurringExpense extends TenantScopedEntity {
  readonly categoryId: UUID | null;
  readonly description: string;
  readonly amount: Money;
  readonly frequency: RecurringFrequency;
  readonly nextRunDate: ISODateString;
  readonly endDate: ISODateString | null;
  readonly isActive: boolean;
  readonly lastGeneratedExpenseId: UUID | null;
}

/**
 * A manually recorded income entry not produced by an invoice payment (for
 * example interest income or a one-off sale recorded outside the
 * invoicing flow).
 */
export interface Income extends TenantScopedEntity {
  readonly source: string;
  readonly category: string | null;
  readonly description: string | null;
  readonly amount: Money;
  readonly incomeDate: ISODateString;
  readonly clientId: UUID | null;
  readonly createdByUserId: UUID;
}

/**
 * A configurable tax rate an owner can apply to invoice/estimate line
 * items (R4.1-R4.3).
 */
export interface TaxRate extends TenantScopedEntity {
  readonly name: string;
  readonly ratePercent: string;
  readonly countryCode: string | null;
  readonly stateCode: string | null;
  readonly isCompound: boolean;
  readonly isDefault: boolean;
}

/**
 * The five standard account types in a chart of accounts.
 */
export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

/**
 * One account in a company's chart of accounts (P7.5), optionally nested
 * under a parent account for sub-account grouping.
 */
export interface ChartOfAccount extends TenantScopedEntity {
  readonly accountCode: string;
  readonly accountName: string;
  readonly accountType: AccountType;
  readonly parentAccountId: UUID | null;
  readonly isActive: boolean;
  readonly description: string | null;
}

/**
 * A double-entry journal entry header (P7.6). `referenceType`/
 * `referenceId` optionally link back to the business event that produced
 * the entry (an invoice, a payment, an expense, or a manual adjustment);
 * there is no foreign key on `referenceId` since it is polymorphic across
 * several possible source tables.
 */
export interface JournalEntry extends TenantScopedEntity {
  readonly entryDate: ISODateString;
  readonly description: string;
  readonly referenceType: string | null;
  readonly referenceId: UUID | null;
  readonly createdByUserId: UUID;
  readonly isLocked: boolean;
}

/**
 * One debit or credit line within a {@link JournalEntry}. Exactly one of
 * `debitAmount`/`creditAmount` is non-zero per line; a valid entry's lines
 * must sum to equal total debits and total credits.
 */
export interface JournalEntryLine {
  readonly id: UUID;
  readonly journalEntryId: UUID;
  readonly accountId: UUID;
  readonly debitAmount: Money;
  readonly creditAmount: Money;
  readonly description: string | null;
}

/**
 * Lifecycle status of a supplier bill (accounts payable).
 */
export type BillStatus = 'draft' | 'received' | 'partially_paid' | 'paid' | 'overdue' | 'void';

/**
 * One line item on a supplier bill.
 */
export interface BillLineItem {
  readonly id: UUID;
  readonly productId: UUID | null;
  readonly description: string;
  readonly quantity: string;
  readonly unitPrice: Money;
  readonly lineTotal: Money;
  readonly sortOrder: number;
}

/**
 * A supplier bill (P6.4/P6.5), the accounts-payable counterpart of an
 * invoice. `supplierId` has no foreign key until Phase 11 creates the
 * suppliers table.
 */
export interface Bill extends TenantScopedEntity {
  readonly supplierId: UUID | null;
  readonly billNumber: string;
  readonly status: BillStatus;
  readonly billDate: ISODateString;
  readonly dueDate: ISODateString;
  readonly lineItems: readonly BillLineItem[];
  readonly subtotal: Money;
  readonly taxTotal: Money;
  readonly total: Money;
  readonly amountPaid: Money;
  readonly amountDue: Money;
  readonly notes: string | null;
  readonly createdByUserId: UUID;
}

/**
 * A connected or manually-created bank account used for feed import and
 * reconciliation (EE6). `accountNumberMasked` only ever shows the last
 * few digits; the full account number is never stored.
 */
export interface BankAccount extends TenantScopedEntity {
  readonly name: string;
  readonly accountNumberMasked: string | null;
  readonly currency: string;
  readonly provider: string | null;
  readonly externalAccountId: string | null;
  readonly currentBalance: Money;
  readonly isActive: boolean;
}

/**
 * One imported or manually entered bank transaction (EE6.2, EE6.12).
 * `amount` is signed: positive for a deposit/credit, negative for a
 * withdrawal/debit.
 */
export interface BankTransaction extends TenantScopedEntity {
  readonly bankAccountId: UUID;
  readonly transactionDate: ISODateString;
  readonly description: string;
  readonly amount: Money;
  readonly externalTransactionId: string | null;
  readonly isReconciled: boolean;
  readonly matchedPaymentId: UUID | null;
  readonly matchedExpenseId: UUID | null;
  readonly matchedBillId: UUID | null;
  readonly reconciledAt: ISODateString | null;
  readonly reconciledByUserId: UUID | null;
}

/**
 * A bank-feed auto-matching rule (EE6.6) applied to incoming transactions.
 */
export interface BankMatchingRule extends TenantScopedEntity {
  readonly matchField: 'description' | 'amount';
  readonly matchPattern: string;
  readonly targetCategoryId: UUID | null;
  readonly isActive: boolean;
}

/**
 * One append-only entry in a bank transaction's reconciliation audit
 * trail (EE6.13).
 */
export interface BankReconciliationLogEntry {
  readonly id: UUID;
  readonly bankTransactionId: UUID;
  readonly action: string;
  readonly performedByUserId: UUID | null;
  readonly notes: string | null;
  readonly createdAt: ISODateString;
}
