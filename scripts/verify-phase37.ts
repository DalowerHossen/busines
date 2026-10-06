import assert from 'node:assert/strict';
import {
  apiKeyCreateSchema,
  blogPostCreateSchema,
  brandingSettingsSchema,
  chartOfAccountCreateSchema,
  companyProfileUpdateSchema,
  contactFormSchema,
  couponCreateSchema,
  customDomainAddSchema,
  ecommerceConnectionCreateSchema,
  emailTemplateCreateSchema,
  expenseCreateSchema,
  faqCreateSchema,
  gatewayConfigSchema,
  journalEntryCreateSchema,
  kycReviewSchema,
  kycSubmissionSchema,
  planCreateSchema,
  productCreateSchema,
  purchaseOrderCreateSchema,
  payoutRequestSchema,
  stockTransferCreateSchema,
  supportTicketCreateSchema,
  supplierCreateSchema,
  teamMemberUpdateSchema,
  warehouseCreateSchema,
  webhookEndpointCreateSchema,
  whatsappTemplateSendSchema,
} from '@/lib/validators';

const companyId = '11111111-1111-4111-8111-111111111111';
const productId = '22222222-2222-4222-8222-222222222222';
const warehouseId = '33333333-3333-4333-8333-333333333333';
const validDate = '2026-10-06T00:00:00.000Z';
const money = { amount: '100.00', currency: 'USD' };

assert.equal(
  productCreateSchema.safeParse({
    type: 'product',
    name: 'Consulting package',
    sku: 'CONSULT-001',
    description: null,
    unitPrice: money,
    defaultTaxRatePercent: '5',
    categoryId: null,
    trackInventory: false,
  }).success,
  true
);
assert.equal(
  productCreateSchema.safeParse({
    type: 'service',
    name: 'Consulting',
    unitPrice: money,
    trackInventory: true,
  }).success,
  false
);
assert.equal(
  expenseCreateSchema.safeParse({
    categoryId: null,
    vendorName: 'Vendor',
    description: 'Software renewal',
    amount: money,
    expenseDate: validDate,
    receiptProviderFileId: null,
    isBillableToClient: true,
    rebillClientId: companyId,
  }).success,
  true
);
assert.equal(
  expenseCreateSchema.safeParse({
    categoryId: null,
    description: 'Software renewal',
    amount: money,
    expenseDate: validDate,
    isBillableToClient: true,
  }).success,
  false
);
assert.equal(
  chartOfAccountCreateSchema.safeParse({
    accountCode: '4000',
    accountName: 'Revenue',
    accountType: 'revenue',
    parentAccountId: null,
    description: null,
  }).success,
  true
);
assert.equal(
  journalEntryCreateSchema.safeParse({
    currency: 'USD',
    entryDate: validDate,
    description: 'Invoice posting',
    lines: [
      { accountId: companyId, debitAmount: '100.00', creditAmount: '0', description: null },
      { accountId: productId, debitAmount: '0', creditAmount: '100.00', description: null },
    ],
  }).success,
  true
);
assert.equal(
  journalEntryCreateSchema.safeParse({
    currency: 'USD',
    entryDate: validDate,
    description: 'Unbalanced entry',
    lines: [
      { accountId: companyId, debitAmount: '100.00', creditAmount: '0' },
      { accountId: productId, debitAmount: '0', creditAmount: '90.00' },
    ],
  }).success,
  false
);
assert.equal(
  warehouseCreateSchema.safeParse({ name: 'Main warehouse', code: 'MAIN' }).success,
  true
);
assert.equal(
  stockTransferCreateSchema.safeParse({
    sourceWarehouseId: warehouseId,
    destinationWarehouseId: warehouseId,
    lines: [{ productId, quantity: '2' }],
    notes: null,
  }).success,
  false
);
assert.equal(
  supplierCreateSchema.safeParse({
    legalName: 'Supplier Ltd',
    email: 'supplier@example.com',
    currency: 'USD',
    notes: null,
  }).success,
  true
);
assert.equal(
  purchaseOrderCreateSchema.safeParse({
    supplierId: null,
    orderNumber: 'PO-1001',
    orderDate: validDate,
    expectedDate: '2026-10-20T00:00:00.000Z',
    currency: 'USD',
    lines: [{ productId, description: 'Hardware', quantity: '5', unitPrice: money }],
    notes: null,
  }).success,
  true
);

assert.equal(
  whatsappTemplateSendSchema.safeParse({
    recipient: '+15551234567',
    body: 'Your invoice is ready.',
    idempotencyKey: 'whatsapp-message-20261006',
    templateName: 'invoice_ready',
    languageCode: 'en_US',
    components: [{ type: 'body', parameters: [{ type: 'text', text: 'INV-1001' }] }],
  }).success,
  true
);
assert.equal(
  apiKeyCreateSchema.safeParse({ name: 'Reporting key', scopes: ['reports:read'], expiresAt: null })
    .success,
  true
);
assert.equal(
  webhookEndpointCreateSchema.safeParse({
    name: 'Billing webhook',
    endpointUrl: 'https://example.com/hooks/billing',
    eventTypes: ['payment.captured'],
    isActive: true,
  }).success,
  true
);
assert.equal(
  webhookEndpointCreateSchema.safeParse({
    name: 'Insecure webhook',
    endpointUrl: 'http://example.com/hooks',
    eventTypes: ['payment.captured'],
    isActive: true,
  }).success,
  false
);
assert.equal(
  ecommerceConnectionCreateSchema.safeParse({
    platform: 'shopify',
    displayName: 'Store',
    storeUrl: 'https://store.example.com',
    isActive: true,
  }).success,
  true
);
assert.equal(
  customDomainAddSchema.safeParse({ companyId, hostname: 'billing.example.com' }).success,
  true
);
assert.equal(
  emailTemplateCreateSchema.safeParse({
    templateKey: 'invoice-paid',
    subjectTemplate: 'Invoice paid',
    bodyHtmlTemplate: '<p>Thank you.</p>',
    bodyTextTemplate: 'Thank you.',
    variableNames: ['invoiceNumber'],
  }).success,
  true
);
assert.equal(
  gatewayConfigSchema.safeParse({
    gateway: 'stripe',
    isEnabled: true,
    cardPaymentsEnabled: true,
    recurringBillingEnabled: true,
    payoutEnabled: false,
    publicConfiguration: {},
  }).success,
  true
);

assert.equal(
  supportTicketCreateSchema.safeParse({
    subject: 'Question',
    category: 'billing',
    priority: 'normal',
    message: 'Please help.',
    attachmentProviderFileIds: [],
  }).success,
  true
);
assert.equal(
  couponCreateSchema.safeParse({
    code: 'WELCOME10',
    discountType: 'percentage',
    discountValue: '10',
    currency: null,
    maxRedemptions: 100,
    validFrom: validDate,
    validUntil: '2026-12-31T00:00:00.000Z',
    appliesTo: 'all_plans',
    planIds: [],
  }).success,
  true
);
assert.equal(
  kycSubmissionSchema.safeParse({
    companyId,
    documents: [
      {
        documentType: 'id_front',
        providerFileId: 'drive-1',
        originalFileName: 'id.png',
        mimeType: 'image/png',
        sizeBytes: 1000,
      },
    ],
  }).success,
  true
);
assert.equal(
  kycReviewSchema.safeParse({
    submissionId: companyId,
    decision: 'reject',
    rejectionReason: 'Image is not readable.',
    reviewedAt: validDate,
  }).success,
  true
);
assert.equal(
  payoutRequestSchema.safeParse({
    walletAccountId: companyId,
    payoutDestinationId: productId,
    currency: 'USD',
    requestedAmount: '50',
    requestedByUserId: companyId,
    idempotencyKey: 'payout-request-20261006',
  }).success,
  true
);
assert.equal(
  planCreateSchema.safeParse({
    tierId: 'starter',
    name: 'Starter',
    monthlyPrice: money,
    yearlyPrice: { amount: '1000.00', currency: 'USD' },
    limits: {
      maxClients: 100,
      maxInvoicesPerMonth: 100,
      maxStaffSeats: 3,
      maxStorageMb: 2048,
      maxWhatsAppMessagesPerMonth: 200,
      allowsCustomBranding: true,
      allowsApiAccess: false,
      allowsMultiCurrency: true,
    },
    isPubliclyVisible: true,
    sortOrder: 1,
  }).success,
  true
);
assert.equal(
  brandingSettingsSchema.safeParse({
    companyName: 'Example',
    logoProviderFileId: null,
    faviconProviderFileId: null,
    primaryColor: '#1D4ED8',
    accentColor: '#0F172A',
    backgroundColor: '#FFFFFF',
    customDomain: null,
  }).success,
  true
);
assert.equal(
  companyProfileUpdateSchema.safeParse({
    name: 'Example',
    slug: 'example',
    legalName: 'Example Ltd',
    email: 'owner@example.com',
    phone: null,
    address: {
      line1: '1 Main Street',
      line2: null,
      city: 'Dhaka',
      state: null,
      postalCode: null,
      country: 'BD',
    },
    taxId: null,
    defaultCurrency: 'BDT',
    defaultCountry: 'BD',
    invoicePrefix: 'INV',
    website: null,
  }).success,
  true
);
assert.equal(
  teamMemberUpdateSchema.safeParse({
    membershipId: companyId,
    role: 'staff',
    permissions: ['manage_invoices'],
    isActive: true,
  }).success,
  true
);
assert.equal(
  contactFormSchema.safeParse({
    name: 'Visitor',
    email: 'visitor@example.com',
    subject: 'Question',
    message: 'Hello.',
    consentToReply: true,
  }).success,
  true
);
assert.equal(
  faqCreateSchema.safeParse({
    question: 'What is this?',
    answer: 'A billing platform.',
    category: null,
    sortOrder: 1,
    isPublished: true,
  }).success,
  true
);
assert.equal(
  blogPostCreateSchema.safeParse({
    categoryId: null,
    title: 'Product update',
    slug: 'product-update',
    excerpt: null,
    body: 'Update details.',
    coverProviderFileId: null,
    seoTitle: null,
    seoDescription: null,
    publishedAt: null,
  }).success,
  true
);

process.stdout.write('Phase 37 validator smoke test passed.\n');
