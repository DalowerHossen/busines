import assert from 'node:assert/strict';
import {
  clientCreateSchema,
  consentRecordHashSchema,
  invoiceCreateSchema,
  paymentConsentSchema,
  paymentCreateSchema,
  savedPaymentMethodSchema,
  signInSchema,
  signUpSchema,
} from '@/lib/validators';

const companyId = '11111111-1111-4111-8111-111111111111';
const clientId = '22222222-2222-4222-8222-222222222222';
const invoiceId = '33333333-3333-4333-8333-333333333333';
const validDate = '2026-10-06T00:00:00.000Z';

assert.equal(
  signInSchema.safeParse({ email: 'Owner@Example.com', password: 'not-a-password' }).success,
  true
);
assert.equal(
  signInSchema.safeParse({ email: 'invalid-email', password: 'not-a-password' }).success,
  false
);
assert.equal(
  signUpSchema.safeParse({
    email: 'owner@example.com',
    password: 'SecurePassword123',
    confirmPassword: 'SecurePassword123',
    fullName: 'Example Owner',
    companyName: 'Example Company',
    termsVersion: '2026-10-06',
    termsAccepted: true,
  }).success,
  true
);
assert.equal(
  signUpSchema.safeParse({
    email: 'owner@example.com',
    password: 'SecurePassword123',
    confirmPassword: 'DifferentPassword123',
    fullName: 'Example Owner',
    companyName: 'Example Company',
    termsVersion: '2026-10-06',
    termsAccepted: true,
  }).success,
  false
);

const lineItem = {
  description: 'Consulting service',
  quantity: '2',
  unitPrice: { amount: '125.50', currency: 'USD' },
  taxRatePercent: '5',
  discountPercent: '0',
};
assert.equal(
  invoiceCreateSchema.safeParse({
    clientId,
    issueDate: validDate,
    dueDate: '2026-10-20T00:00:00.000Z',
    currency: 'USD',
    lineItems: [lineItem],
    notes: null,
    internalNotes: null,
    templateId: null,
  }).success,
  true
);
assert.equal(
  invoiceCreateSchema.safeParse({
    clientId,
    issueDate: '2026-10-20T00:00:00.000Z',
    dueDate: validDate,
    currency: 'USD',
    lineItems: [lineItem],
    notes: null,
    internalNotes: null,
    templateId: null,
  }).success,
  false
);

assert.equal(
  paymentCreateSchema.safeParse({
    invoiceId,
    clientId,
    gateway: 'stripe',
    amount: '100.00',
    currency: 'USD',
    savedPaymentMethodId: null,
    is3dsEnabled: false,
    idempotencyKey: 'payment-2026-unique-01',
  }).success,
  true
);
assert.equal(
  paymentCreateSchema.safeParse({
    invoiceId,
    clientId,
    gateway: 'stripe',
    amount: '100.00',
    currency: 'USD',
    idempotencyKey: 'short',
  }).success,
  false
);
assert.equal(
  savedPaymentMethodSchema.safeParse({
    clientId,
    gateway: 'stripe',
    gatewayToken: 'provider-token',
    cardLastFourDigits: '4242',
    isDefault: true,
  }).success,
  true
);
assert.equal(
  savedPaymentMethodSchema.safeParse({
    clientId,
    gateway: 'stripe',
    gatewayToken: 'provider-token',
    cardNumber: '4242424242424242',
    isDefault: true,
  }).success,
  false
);

assert.equal(
  clientCreateSchema.safeParse({
    displayName: 'Example Client',
    companyNameOnInvoice: null,
    email: 'client@example.com',
    phone: null,
    billingAddress: null,
    shippingAddress: null,
    taxId: null,
    defaultCurrency: 'USD',
    groupId: null,
    tagIds: [],
    notes: null,
  }).success,
  true
);

const consent = paymentConsentSchema.safeParse({
  companyId,
  documentType: 'invoice',
  documentId: invoiceId,
  clientId,
  consentCheckboxAccepted: true,
  receivedGoodsOrServicesConfirmed: true,
  invoiceDetailsReadConfirmed: true,
  consentTextSnapshot: 'I agree to pay this invoice.',
  termsVersion: 'terms-2026-10',
  termsTextSnapshot: 'Payment terms.',
  consentedAt: validDate,
  ipAddress: '192.0.2.10',
  geoCountryCode: 'US',
  userAgent: 'Example browser',
});
assert.equal(consent.success, true);
assert.equal(
  paymentConsentSchema.safeParse({
    companyId,
    documentType: 'invoice',
    documentId: invoiceId,
    clientId,
    consentCheckboxAccepted: false,
    receivedGoodsOrServicesConfirmed: true,
    invoiceDetailsReadConfirmed: true,
    consentTextSnapshot: 'I agree to pay this invoice.',
    consentedAt: validDate,
  }).success,
  false
);
assert.equal(consentRecordHashSchema.safeParse({ recordHash: 'a'.repeat(64) }).success, true);

process.stdout.write('Phase 36 validator smoke test passed.\n');
