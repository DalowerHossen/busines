import { createHash } from 'node:crypto';
import { invalidMorRequest, invalidMorState } from './errors';
import type {
  ConsentRecordInput,
  DeliveryAcceptanceRecord,
  DisputeAuditEvent,
  DisputeAuditEventInput,
  EvidencePackBundle,
  EvidencePackInput,
  ImmutableConsentRecord,
} from './types';

const FORBIDDEN_EVIDENCE_KEYS = new Set([
  'cardnumber',
  'card_number',
  'pan',
  'cvv',
  'cvc',
  'securitycode',
  'security_code',
  'bankaccountnumber',
  'bank_account_number',
  'achaccountnumber',
  'ach_account_number',
]);

export function capturePaymentConsent(input: ConsentRecordInput): ImmutableConsentRecord {
  if (
    !input.companyId ||
    !input.documentId ||
    !input.clientId ||
    !input.consentTextSnapshot.trim() ||
    !input.termsVersion?.trim() ||
    !input.termsTextSnapshot?.trim() ||
    !input.refundPolicyVersion?.trim() ||
    !input.refundPolicyTextSnapshot?.trim() ||
    !input.consentCheckboxAccepted ||
    !input.receivedGoodsOrServicesConfirmed ||
    !input.invoiceDetailsReadConfirmed ||
    !Number.isFinite(Date.parse(input.consentedAt))
  ) {
    throw invalidMorRequest();
  }
  const snapshot = {
    ...input,
    consentTextSnapshot: input.consentTextSnapshot.trim(),
    termsVersion: input.termsVersion.trim(),
    termsTextSnapshot: input.termsTextSnapshot.trim(),
    refundPolicyVersion: input.refundPolicyVersion.trim(),
    refundPolicyTextSnapshot: input.refundPolicyTextSnapshot.trim(),
  };
  return { ...snapshot, recordHash: sha256(canonicalize(snapshot)) };
}

export function appendDisputeAuditEvent(
  previousEventHash: string | null,
  input: DisputeAuditEventInput
): DisputeAuditEvent {
  if (
    !input.companyId ||
    !input.documentId ||
    !input.eventType.trim() ||
    !Number.isFinite(Date.parse(input.occurredAt))
  ) {
    throw invalidMorRequest();
  }
  const event = {
    ...input,
    eventType: input.eventType.trim(),
    eventData: sanitizeEvidenceRecord(input.eventData),
    previousEventHash,
  };
  return { ...event, eventHash: sha256(canonicalize(event)) };
}

export function verifyDisputeAuditChain(events: readonly DisputeAuditEvent[]): boolean {
  let previousEventHash: string | null = null;
  for (const event of events) {
    if (event.previousEventHash !== previousEventHash) return false;
    const expected = sha256(
      canonicalize({
        companyId: event.companyId,
        documentType: event.documentType,
        documentId: event.documentId,
        eventType: event.eventType,
        eventData: sanitizeEvidenceValue(event.eventData),
        ...(event.ipAddress === undefined ? {} : { ipAddress: event.ipAddress }),
        ...(event.userAgent === undefined ? {} : { userAgent: event.userAgent }),
        occurredAt: event.occurredAt,
        previousEventHash: event.previousEventHash,
      })
    );
    if (event.eventHash !== expected) return false;
    previousEventHash = event.eventHash;
  }
  return true;
}

export function validateDeliveryAcceptance(
  record: DeliveryAcceptanceRecord
): DeliveryAcceptanceRecord {
  if (!record.companyId || !record.documentId || !record.documentType) throw invalidMorRequest();
  const dateValues = [
    record.deliveryConfirmedAt,
    record.serviceCompletedAt,
    record.clientAcknowledgedAt,
    record.clientAcceptedViaLinkAt,
  ];
  if (dateValues.some((value) => value !== null && !Number.isFinite(Date.parse(value)))) {
    throw invalidMorRequest();
  }
  if (
    !dateValues.some((value) => value !== null) &&
    !record.clientEsignatureProviderFileId &&
    !record.deliveryProofProviderFileId
  ) {
    throw invalidMorRequest();
  }
  return record;
}

export function buildDisputeEvidencePack(input: EvidencePackInput): EvidencePackBundle {
  if (
    !input.companyId ||
    !input.chargebackId ||
    !input.paymentId ||
    !input.generatedByUserId ||
    !Number.isFinite(Date.parse(input.generatedAt)) ||
    (input.renderedPdfSha256 !== null && !/^[a-f0-9]{64}$/iu.test(input.renderedPdfSha256))
  ) {
    throw invalidMorRequest();
  }
  if (!verifyDisputeAuditChain(input.auditEvents)) throw invalidMorState();
  if (
    input.consent &&
    (input.consent.companyId !== input.companyId ||
      input.consent.documentType !== input.documentType ||
      input.consent.documentId !== input.documentId ||
      !isConsentRecordHashValid(input.consent))
  ) {
    throw invalidMorState();
  }
  if (
    input.delivery &&
    (input.delivery.companyId !== input.companyId ||
      input.delivery.documentType !== input.documentType ||
      input.delivery.documentId !== input.documentId)
  ) {
    throw invalidMorState();
  }
  if (
    input.auditEvents.some(
      (event) =>
        event.companyId !== input.companyId ||
        event.documentType !== input.documentType ||
        event.documentId !== input.documentId
    )
  ) {
    throw invalidMorState();
  }
  if (input.delivery) validateDeliveryAcceptance(input.delivery);
  const sanitizedInput = sanitizeEvidenceValue(input) as unknown as EvidencePackInput;
  const canonicalJson = canonicalize({
    artifactType: 'dispute-evidence-pack',
    version: '1',
    format: sanitizedInput.format,
    chargebackId: sanitizedInput.chargebackId,
    paymentId: sanitizedInput.paymentId,
    documentType: sanitizedInput.documentType,
    documentId: sanitizedInput.documentId,
    invoiceSnapshot: sanitizedInput.invoiceSnapshot,
    consent: sanitizedInput.consent,
    delivery: sanitizedInput.delivery,
    auditEvents: sanitizedInput.auditEvents,
    emailProofs: sanitizedInput.emailProofs,
    attachmentProofs: sanitizedInput.attachmentProofs,
    renderedPdfSha256: sanitizedInput.renderedPdfSha256,
  });
  const manifest = {
    artifactType: 'dispute-evidence-pack',
    version: '1',
    format: sanitizedInput.format,
    generatedAt: sanitizedInput.generatedAt,
    chargebackId: sanitizedInput.chargebackId,
    paymentId: sanitizedInput.paymentId,
    consentHash: sanitizedInput.consent?.recordHash ?? null,
    auditEventCount: sanitizedInput.auditEvents.length,
    emailProofCount: sanitizedInput.emailProofs.length,
    attachmentProofCount: sanitizedInput.attachmentProofs.length,
    renderedPdfSha256: sanitizedInput.renderedPdfSha256,
    canonicalJsonSha256: sha256(canonicalJson),
  };
  const reviewHtml = renderReviewHtml(manifest, sanitizedInput);
  return {
    format: sanitizedInput.format,
    manifest,
    canonicalJson,
    reviewHtml,
    contentSha256: sha256(`${canonicalJson}\n${reviewHtml}`),
  };
}

function isConsentRecordHashValid(input: ImmutableConsentRecord): boolean {
  const { recordHash: expectedHash, ...consentInput } = input;
  return capturePaymentConsent(consentInput).recordHash === expectedHash;
}

function renderReviewHtml(
  manifest: Readonly<Record<string, unknown>>,
  input: EvidencePackInput
): string {
  const consentText = input.consent?.consentTextSnapshot ?? 'No consent record was supplied.';
  const termsText = input.consent?.termsTextSnapshot ?? 'No terms snapshot was supplied.';
  const refundText =
    input.consent?.refundPolicyTextSnapshot ?? 'No refund policy snapshot was supplied.';
  return [
    '<!doctype html><html><head><meta charset="utf-8"><title>Dispute Evidence Pack</title></head><body>',
    '<h1>Dispute Evidence Pack</h1>',
    `<p>Chargeback: ${escapeHtml(String(manifest.chargebackId))}</p>`,
    `<p>Payment: ${escapeHtml(String(manifest.paymentId))}</p>`,
    '<h2>Consent snapshot</h2>',
    `<p>${escapeHtml(consentText)}</p>`,
    `<h3>Terms</h3><p>${escapeHtml(termsText)}</p>`,
    `<h3>Refund policy</h3><p>${escapeHtml(refundText)}</p>`,
    '<h2>Evidence manifest</h2>',
    `<pre>${escapeHtml(JSON.stringify(manifest, null, 2))}</pre>`,
    '<h2>Audit timeline</h2>',
    `<pre>${escapeHtml(JSON.stringify(input.auditEvents, null, 2))}</pre>`,
    '</body></html>',
  ].join('');
}

function sanitizeEvidenceRecord(
  value: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> {
  const sanitized = sanitizeEvidenceValue(value);
  if (typeof sanitized !== 'object' || sanitized === null || Array.isArray(sanitized)) {
    throw invalidMorRequest();
  }
  return sanitized as Readonly<Record<string, unknown>>;
}

function sanitizeEvidenceValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => sanitizeEvidenceValue(item));
  if (typeof value !== 'object' || value === null) return value;
  const record = value as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(record)) {
    if (FORBIDDEN_EVIDENCE_KEYS.has(key.replace(/[^a-z0-9_]/giu, '').toLowerCase())) continue;
    sanitized[key] = sanitizeEvidenceValue(nestedValue);
  }
  return sanitized;
}

function canonicalize(value: unknown): string {
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'number' ||
    typeof value === 'string'
  ) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((item) => canonicalize(item)).join(',')}]`;
  if (typeof value !== 'object') throw invalidMorRequest();
  const record = value as Record<string, unknown>;
  const entries = Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`);
  return `{${entries.join(',')}}`;
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character] ?? character;
  });
}
