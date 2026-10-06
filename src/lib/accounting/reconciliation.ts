import { alreadyReconciled, ambiguousBankMatch, invalidAccountingRequest } from './errors';
import { compareAccountingAmounts, normalizeAccountingAmount } from './money';
import type {
  BankMatchCandidate,
  BankMatchSuggestion,
  BankMatchingRuleInput,
  BankReconciliationDecision,
  BankTransactionForMatching,
} from './types';

export interface BankReconciliationStore {
  persist(input: BankReconciliationDecision): Promise<BankReconciliationDecision>;
}

export function suggestBankMatches(input: {
  readonly transaction: BankTransactionForMatching;
  readonly candidates: readonly BankMatchCandidate[];
  readonly rules: readonly BankMatchingRuleInput[];
  readonly minimumConfidence: number;
}): readonly BankMatchSuggestion[] {
  validateMatchThreshold(input.minimumConfidence);
  if (input.transaction.isReconciled) throw alreadyReconciled();
  const transactionAmount = normalizeAccountingAmount(input.transaction.amount, {
    allowNegative: true,
  });
  const transactionDescription = normalizeText(input.transaction.description);
  const transactionDate = parseDate(input.transaction.transactionDate);
  const companyRules = input.rules.filter(
    (rule) => rule.companyId === input.transaction.companyId && rule.isActive
  );
  return input.candidates
    .filter((candidate) => candidate.companyId === input.transaction.companyId)
    .map((candidate): BankMatchSuggestion | null => {
      const candidateAmount = normalizeAccountingAmount(candidate.amount, { allowNegative: true });
      if (compareAccountingAmounts(transactionAmount, candidateAmount) !== 0) return null;
      const matchedBy: Array<'amount' | 'description' | 'rule'> = ['amount'];
      let confidence = 0.7;
      if (normalizeText(candidate.description) === transactionDescription) {
        matchedBy.push('description');
        confidence += 0.2;
      } else if (
        transactionDescription.includes(normalizeText(candidate.description)) ||
        normalizeText(candidate.description).includes(transactionDescription)
      ) {
        matchedBy.push('description');
        confidence += 0.1;
      }
      const dateDistance = Math.abs(
        (transactionDate.getTime() - parseDate(candidate.transactionDate).getTime()) /
          (24 * 60 * 60 * 1000)
      );
      if (dateDistance > 7) return null;
      confidence += Math.max(0, 0.1 - dateDistance / 70);
      if (companyRules.some((rule) => ruleMatches(rule, input.transaction, transactionAmount))) {
        matchedBy.push('rule');
        confidence = Math.min(1, confidence + 0.1);
      }
      return { candidate, confidence, matchedBy } satisfies BankMatchSuggestion;
    })
    .filter((suggestion): suggestion is BankMatchSuggestion => suggestion !== null)
    .filter((suggestion) => suggestion.confidence >= input.minimumConfidence)
    .sort((left, right) => right.confidence - left.confidence);
}

export function chooseBankMatch(input: {
  readonly suggestions: readonly BankMatchSuggestion[];
  readonly minimumConfidence: number;
}): BankMatchSuggestion | null {
  validateMatchThreshold(input.minimumConfidence);
  const eligible = input.suggestions.filter(
    (suggestion) => suggestion.confidence >= input.minimumConfidence
  );
  const [first, second] = eligible;
  if (!first) return null;
  if (second && first.confidence === second.confidence) throw ambiguousBankMatch();
  return first;
}

export async function reconcileBankTransaction(input: {
  readonly transaction: BankTransactionForMatching;
  readonly candidate: BankMatchCandidate;
  readonly reconciledByUserId: string | null;
  readonly reconciledAt: string;
  readonly store: BankReconciliationStore;
}): Promise<BankReconciliationDecision> {
  const { transaction, candidate } = input;
  if (transaction.isReconciled) throw alreadyReconciled();
  if (
    !transaction.id.trim() ||
    !candidate.id.trim() ||
    transaction.companyId !== candidate.companyId ||
    compareAccountingAmounts(transaction.amount, candidate.amount) !== 0 ||
    !Number.isFinite(Date.parse(input.reconciledAt)) ||
    (input.reconciledByUserId !== null && !input.reconciledByUserId.trim())
  ) {
    throw invalidAccountingRequest();
  }
  return input.store.persist({
    bankTransactionId: transaction.id,
    candidateId: candidate.id,
    candidateType: candidate.candidateType,
    status: 'reconciled',
    amount: normalizeAccountingAmount(transaction.amount, { allowNegative: true }),
    reconciledByUserId: input.reconciledByUserId,
    reconciledAt: input.reconciledAt,
  });
}

function ruleMatches(
  rule: BankMatchingRuleInput,
  transaction: BankTransactionForMatching,
  normalizedAmount: string
): boolean {
  if (!rule.matchPattern.trim()) return false;
  if (rule.matchField === 'description') {
    return normalizeText(transaction.description).includes(normalizeText(rule.matchPattern));
  }
  try {
    return (
      compareAccountingAmounts(
        normalizedAmount,
        normalizeAccountingAmount(rule.matchPattern, { allowNegative: true })
      ) === 0
    );
  } catch {
    return false;
  }
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/gu, ' ').toLowerCase();
}

function parseDate(value: string): Date {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw invalidAccountingRequest();
  return new Date(timestamp);
}

function validateMatchThreshold(value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw invalidAccountingRequest();
}
