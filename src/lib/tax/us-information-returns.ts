import type {
  FilerConfiguration,
  InformationReturnRow,
  InformationReturnRuleSet,
  TaxIdentityProfile,
  TaxPaymentRecord,
  TaxValidationIssue,
  UsInformationReturnForm,
} from './types';

const SUPPORTED_CURRENCY = 'USD';
const VALID_US_DOCUMENT_TYPES = new Set(['W-9']);
const VALID_FOREIGN_DOCUMENT_TYPES = new Set(['W-8BEN', 'W-8BEN-E', 'W-8ECI', 'W-8IMY']);

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isValidDate(value: string | null, now: Date): boolean {
  if (value === null) {
    return false;
  }

  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date <= now;
}

function taxIdentityIssues(
  profile: TaxIdentityProfile | undefined,
  rules: InformationReturnRuleSet,
  now: Date
): TaxValidationIssue[] {
  if (!profile) {
    return [
      {
        code: 'missing_tax_identity',
        severity: 'error',
        message:
          'A current payee tax identity document is required before generating an information return.',
      },
    ];
  }

  const issues: TaxValidationIssue[] = [];
  const isForeign = profile.personType !== 'us_person';
  const validDocumentType = isForeign
    ? VALID_FOREIGN_DOCUMENT_TYPES.has(profile.documentType)
    : VALID_US_DOCUMENT_TYPES.has(profile.documentType);

  if (!validDocumentType || profile.status !== 'verified') {
    issues.push({
      code: 'invalid_tax_identity',
      severity: 'error',
      message: 'The payee tax identity document is not valid for the payee classification.',
    });
  }

  if (
    profile.status === 'expired' ||
    (profile.validUntil !== null && new Date(profile.validUntil) < now)
  ) {
    issues.push({
      code: 'expired_tax_identity',
      severity: 'error',
      message: 'The payee tax identity document is expired and must be replaced.',
    });
  }

  if (!isValidDate(profile.signedAt, now) || profile.signedAt === null) {
    issues.push({
      code: 'invalid_tax_identity',
      severity: 'error',
      message: 'The payee tax identity document has no valid signature date.',
    });
  }

  if (
    profile.personType === 'us_person' &&
    (!profile.hasEncryptedTin || profile.tinLastFour === null)
  ) {
    issues.push({
      code: 'missing_tin',
      severity: 'error',
      message:
        'The payee tax identity does not have an encrypted TIN and safe TIN fingerprint on file.',
    });
  }

  if (
    (profile.personType === 'us_person' || profile.personType === 'foreign_entity') &&
    !profile.entityClassification?.trim()
  ) {
    issues.push({
      code: 'invalid_tax_identity',
      severity: 'error',
      message: 'The payee tax identity is missing its federal entity classification.',
    });
  }

  const address = profile.address;
  if (
    address.line1.trim() === '' ||
    address.city.trim() === '' ||
    address.stateOrProvince.trim() === '' ||
    address.postalCode.trim() === '' ||
    address.countryCode.trim() === ''
  ) {
    issues.push({
      code: 'missing_address',
      severity: 'error',
      message: 'The payee mailing address is incomplete.',
    });
  }

  if (
    profile.backupWithholdingRequired &&
    profile.backupWithholdingRate !== rules.backupWithholdingRate
  ) {
    issues.push({
      code: 'invalid_tax_identity',
      severity: 'error',
      message: 'The payee backup-withholding rate does not match the active tax-year policy.',
    });
  }

  return issues;
}

function paymentAmount(payment: TaxPaymentRecord): number {
  return roundCurrency(payment.amount - (payment.refundAmount ?? 0));
}

export function calculateBackupWithholding(
  grossAmount: number,
  profile: TaxIdentityProfile,
  rules: InformationReturnRuleSet
): number {
  if (!profile.backupWithholdingRequired) {
    return 0;
  }
  if (grossAmount < 0 || profile.backupWithholdingRate !== rules.backupWithholdingRate) {
    throw new Error('Backup withholding inputs do not match the active tax-year policy.');
  }
  return roundCurrency(grossAmount * (rules.backupWithholdingRate / 100));
}

function isPaymentCardReportable(payment: TaxPaymentRecord): boolean {
  return payment.isPaymentCardTransaction === true || payment.channel === 'payment_card';
}

function isTpsoReportable(
  paymentTotal: number,
  paymentCount: number,
  rules: InformationReturnRuleSet
): boolean {
  return paymentTotal > rules.tpsoGrossThreshold && paymentCount > rules.tpsoTransactionThreshold;
}

function isNecReportable(total: number, rules: InformationReturnRuleSet): boolean {
  return total >= rules.nonEmployeeCompensationThreshold;
}

function isMiscReportable(
  category: TaxPaymentRecord['incomeCategory'],
  total: number,
  rules: InformationReturnRuleSet
): boolean {
  const threshold = rules.miscThresholds[category];
  return threshold !== undefined && total >= threshold;
}

function isEntityExcluded(
  profile: TaxIdentityProfile | undefined,
  excludedClassifications: readonly string[]
): boolean {
  const classification = profile?.entityClassification?.trim().toLowerCase();
  return classification !== undefined && excludedClassifications.includes(classification);
}

function miscBoxes(
  category: TaxPaymentRecord['incomeCategory'],
  total: number,
  withholding: number
): Readonly<Record<string, string | number>> {
  if (category === 'rent') {
    return { box1_rents: total, box4_federal_income_tax_withheld: withholding };
  }
  if (category === 'royalties') {
    return { box2_royalties: total, box4_federal_income_tax_withheld: withholding };
  }
  if (category === 'medical_healthcare') {
    return {
      box6_medical_and_health_care_payments: total,
      box4_federal_income_tax_withheld: withholding,
    };
  }
  if (category === 'attorney') {
    return {
      box10_gross_proceeds_paid_to_an_attorney: total,
      box4_federal_income_tax_withheld: withholding,
    };
  }
  return { box3_other_income: total, box4_federal_income_tax_withheld: withholding };
}

function addRow(
  rows: InformationReturnRow[],
  formType: UsInformationReturnForm,
  profile: TaxIdentityProfile | undefined,
  payments: readonly TaxPaymentRecord[],
  rules: InformationReturnRuleSet,
  now: Date
): void {
  const firstPayment = payments[0];
  if (!firstPayment) {
    return;
  }

  const total = roundCurrency(
    payments.reduce(
      (sum, payment) => sum + (formType === '1099-K' ? payment.amount : paymentAmount(payment)),
      0
    )
  );
  const negativeAmountPayments = payments.filter((payment) => paymentAmount(payment) < 0);
  const transactionCount = payments.reduce(
    (sum, payment) => sum + (payment.transactionCount ?? 1),
    0
  );
  const withholding = roundCurrency(
    payments.reduce((sum, payment) => sum + (payment.federalWithholdingAmount ?? 0), 0)
  );
  const issues = taxIdentityIssues(profile, rules, now).map((issue) => ({
    ...issue,
    payeeId: firstPayment.payeeId,
    formType,
  }));
  if (
    profile?.backupWithholdingRequired &&
    profile.backupWithholdingRate === rules.backupWithholdingRate
  ) {
    const netPositiveAmount = Math.max(
      0,
      payments.reduce((sum, payment) => sum + paymentAmount(payment), 0)
    );
    const expectedWithholding = calculateBackupWithholding(netPositiveAmount, profile, rules);
    if (withholding + 0.01 < expectedWithholding) {
      issues.push({
        code: 'withholding_mismatch',
        severity: 'error',
        message: 'Recorded federal withholding is below the configured backup-withholding amount.',
        payeeId: firstPayment.payeeId,
        formType,
      });
    }
  }
  if (negativeAmountPayments.length > 0) {
    issues.push({
      code: 'negative_reportable_amount',
      severity: 'error',
      message: 'A payment refund exceeds its source payment and cannot be reported.',
      payeeId: firstPayment.payeeId,
      formType,
    });
  }

  if (!profile) {
    rows.push({
      formType,
      payeeId: firstPayment.payeeId,
      recipientName: 'Unknown payee',
      recipientAddress: {
        line1: '',
        city: '',
        stateOrProvince: '',
        postalCode: '',
        countryCode: 'US',
      },
      recipientTinLastFour: null,
      accountReference: firstPayment.payeeId,
      grossAmount: total,
      transactionCount,
      federalWithholdingAmount: withholding,
      boxes: {},
      issues,
    });
    return;
  }

  rows.push({
    formType,
    payeeId: firstPayment.payeeId,
    recipientName: profile.legalName,
    recipientAddress: profile.address,
    recipientTinLastFour: profile.tinLastFour,
    accountReference: firstPayment.payeeId,
    grossAmount: total,
    transactionCount,
    federalWithholdingAmount: withholding,
    boxes:
      formType === '1099-K'
        ? {
            box1a_gross_payment_amount: total,
            box1_number_of_payment_transactions: transactionCount,
          }
        : formType === '1099-NEC'
          ? { box1_nonemployee_compensation: total, box4_federal_income_tax_withheld: withholding }
          : miscBoxes(firstPayment.incomeCategory, total, withholding),
    issues,
  });
}

export function validateFilerConfiguration(
  filer: FilerConfiguration | null
): readonly TaxValidationIssue[] {
  if (!filer || filer.legalName.trim() === '' || !filer.hasEncryptedEin) {
    return [
      {
        code: 'missing_filer_configuration',
        severity: 'error',
        message:
          'A legal filer name and encrypted federal EIN are required before preparing tax documents.',
      },
    ];
  }

  const address = filer.address;
  if (
    address.line1.trim() === '' ||
    address.city.trim() === '' ||
    address.stateOrProvince.trim() === '' ||
    address.postalCode.trim() === '' ||
    address.countryCode.trim() === ''
  ) {
    return [
      {
        code: 'missing_address',
        severity: 'error',
        message: 'The legal filer address is incomplete.',
      },
    ];
  }

  return [];
}

export function buildInformationReturnRows(
  payments: readonly TaxPaymentRecord[],
  profiles: ReadonlyMap<string, TaxIdentityProfile>,
  rules: InformationReturnRuleSet,
  now = new Date()
): readonly InformationReturnRow[] {
  if (rules.taxYear < 2026) {
    throw new Error('This U.S. information-return builder supports tax year 2026 and later.');
  }

  const grouped = new Map<string, TaxPaymentRecord[]>();
  for (const payment of payments) {
    if (payment.currencyCode !== SUPPORTED_CURRENCY) {
      continue;
    }
    const current = grouped.get(payment.payeeId) ?? [];
    current.push(payment);
    grouped.set(payment.payeeId, current);
  }

  const rows: InformationReturnRow[] = [];
  for (const [payeeId, payeePayments] of grouped.entries()) {
    const profile = profiles.get(payeeId);
    if (profile?.personType !== undefined && profile.personType !== 'us_person') {
      continue;
    }
    const cardPayments = payeePayments.filter(isPaymentCardReportable);
    const networkPayments = payeePayments.filter(
      (payment) => payment.channel === 'third_party_network'
    );

    if (cardPayments.length > 0) {
      addRow(rows, '1099-K', profile, cardPayments, rules, now);
    } else if (
      networkPayments.length > 0 &&
      isTpsoReportable(
        roundCurrency(networkPayments.reduce((sum, payment) => sum + payment.amount, 0)),
        networkPayments.reduce((sum, payment) => sum + (payment.transactionCount ?? 1), 0),
        rules
      )
    ) {
      addRow(rows, '1099-K', profile, networkPayments, rules, now);
    }

    const directPayments = payeePayments.filter((payment) => payment.channel === 'other');
    const services = directPayments.filter((payment) => payment.incomeCategory === 'services');
    const servicesTotal = roundCurrency(
      services.reduce((sum, payment) => sum + paymentAmount(payment), 0)
    );
    if (
      services.length > 0 &&
      !isEntityExcluded(profile, rules.necExemptEntityClassifications) &&
      isNecReportable(servicesTotal, rules)
    ) {
      addRow(rows, '1099-NEC', profile, services, rules, now);
    }

    const miscPayments = directPayments.filter((payment) => payment.incomeCategory !== 'services');
    const miscCategories = new Set(miscPayments.map((payment) => payment.incomeCategory));
    for (const category of miscCategories) {
      const categoryPayments = miscPayments.filter(
        (payment) => payment.incomeCategory === category
      );
      const categoryTotal = roundCurrency(
        categoryPayments.reduce((sum, payment) => sum + paymentAmount(payment), 0)
      );
      if (
        !isEntityExcluded(profile, rules.miscExemptEntityClassifications[category] ?? []) &&
        isMiscReportable(category, categoryTotal, rules)
      ) {
        addRow(rows, '1099-MISC', profile, categoryPayments, rules, now);
      }
    }
  }

  return rows;
}

export function collectRowIssues(
  rows: readonly InformationReturnRow[]
): readonly TaxValidationIssue[] {
  return rows.flatMap((row) => row.issues);
}

export function getDefault2026InformationReturnRules(): InformationReturnRuleSet {
  return {
    taxYear: 2026,
    policyVersion: 'us-2026-01',
    tpsoGrossThreshold: 20000,
    tpsoTransactionThreshold: 200,
    nonEmployeeCompensationThreshold: 2000,
    miscThresholds: {
      rent: 2000,
      royalties: 2000,
      medical_healthcare: 2000,
      attorney: 600,
      prizes_awards: 2000,
      other: 2000,
    },
    necExemptEntityClassifications: [
      'corporation',
      'c_corporation',
      's_corporation',
      'llc_taxed_as_c_corp',
      'llc_taxed_as_s_corp',
    ],
    miscExemptEntityClassifications: {
      rent: [
        'corporation',
        'c_corporation',
        's_corporation',
        'llc_taxed_as_c_corp',
        'llc_taxed_as_s_corp',
      ],
      royalties: [
        'corporation',
        'c_corporation',
        's_corporation',
        'llc_taxed_as_c_corp',
        'llc_taxed_as_s_corp',
      ],
      prizes_awards: [
        'corporation',
        'c_corporation',
        's_corporation',
        'llc_taxed_as_c_corp',
        'llc_taxed_as_s_corp',
      ],
      other: [
        'corporation',
        'c_corporation',
        's_corporation',
        'llc_taxed_as_c_corp',
        'llc_taxed_as_s_corp',
      ],
    },
    backupWithholdingRate: 24,
    filingDeadlines: {},
    sourceUrls: [
      'https://www.irs.gov/instructions/i1099k',
      'https://www.irs.gov/instructions/i1099mec',
      'https://www.irs.gov/publications/p1099',
    ],
    irsElectronicFilingSystem: 'IRIS',
    irsElectronicFilingConfigured: false,
  };
}
