import { createHash } from 'node:crypto';

import { assertSuperAdmin, type TaxComplianceActor } from './tax-compliance-admin';
import { buildUsTaxDocumentPackage } from './tax-document-package';
import type {
  FilerConfiguration,
  InformationReturnRuleSet,
  TaxDocumentPackage,
  TaxIdentityProfile,
  TaxPaymentRecord,
} from './types';

export interface TaxDocumentRunRowWrite {
  readonly formType: TaxDocumentPackage['rows'][number]['formType'];
  readonly payeeId: string;
  readonly recipientName: string;
  readonly recipientAddress: TaxDocumentPackage['rows'][number]['recipientAddress'];
  readonly recipientTinLastFour: string | null;
  readonly accountReference: string;
  readonly grossAmount: number;
  readonly transactionCount: number;
  readonly federalWithholdingAmount: number;
  readonly boxes: TaxDocumentPackage['rows'][number]['boxes'];
  readonly isReportable: boolean;
  readonly validationErrors: TaxDocumentPackage['rows'][number]['issues'];
  readonly rowSha256: string;
}

export interface TaxDocumentRunWrite {
  readonly taxYear: number;
  readonly revisionNumber: number;
  readonly supersedesRunId: string | null;
  readonly correctionReason: string | null;
  readonly policyVersion: string;
  readonly policySnapshot: InformationReturnRuleSet;
  readonly filer: FilerConfiguration;
  readonly status: 'draft' | 'ready';
  readonly totalFormCount: number;
  readonly validationErrorCount: number;
  readonly csvSha256: string;
  readonly reportSha256: string;
}

export interface TaxComplianceEventWrite {
  readonly eventType: 'tax_document_run_created' | 'tax_document_run_failed';
  readonly runId: string;
  readonly actorUserId: string;
  readonly eventPayload: Readonly<Record<string, string | number | boolean>>;
}

export interface TaxDocumentRunStore {
  createRun(input: TaxDocumentRunWrite): Promise<{ runId: string }>;
  insertRows(runId: string, rows: readonly TaxDocumentRunRowWrite[]): Promise<void>;
  appendEvent(input: TaxComplianceEventWrite): Promise<void>;
}

function hashRow(row: TaxDocumentPackage['rows'][number]): string {
  const safeRow = {
    formType: row.formType,
    payeeId: row.payeeId,
    recipientName: row.recipientName,
    recipientAddress: row.recipientAddress,
    recipientTinLastFour: row.recipientTinLastFour,
    accountReference: row.accountReference,
    grossAmount: row.grossAmount,
    transactionCount: row.transactionCount,
    federalWithholdingAmount: row.federalWithholdingAmount,
    boxes: row.boxes,
    issues: row.issues,
  };
  return createHash('sha256').update(JSON.stringify(safeRow)).digest('hex');
}

export async function prepareAndRecordUsTaxDocumentRun(input: {
  readonly actor: TaxComplianceActor;
  readonly filer: FilerConfiguration | null;
  readonly rules: InformationReturnRuleSet;
  readonly payments: readonly TaxPaymentRecord[];
  readonly profiles: ReadonlyMap<string, TaxIdentityProfile>;
  readonly store: TaxDocumentRunStore;
  readonly generatedAt?: Date;
  readonly revisionNumber?: number;
  readonly supersedesRunId?: string | null;
  readonly correctionReason?: string | null;
}): Promise<{ runId: string; documentPackage: TaxDocumentPackage }> {
  assertSuperAdmin(input.actor);
  if (input.filer === null) {
    throw new Error('A configured platform filer is required to persist a tax document run.');
  }
  if ((input.revisionNumber ?? 1) < 1) {
    throw new Error('Tax document run revision must be a positive integer.');
  }
  if (input.supersedesRunId && !input.correctionReason?.trim()) {
    throw new Error('A correction reason is required when superseding a tax document run.');
  }

  const documentPackage = buildUsTaxDocumentPackage(input);
  const run = await input.store.createRun({
    taxYear: documentPackage.taxYear,
    revisionNumber: input.revisionNumber ?? 1,
    supersedesRunId: input.supersedesRunId ?? null,
    correctionReason: input.correctionReason ?? null,
    policyVersion: documentPackage.policyVersion,
    policySnapshot: input.rules,
    filer: input.filer,
    status: documentPackage.status === 'ready' ? 'ready' : 'draft',
    totalFormCount: documentPackage.rows.length,
    validationErrorCount: documentPackage.issues.filter((issue) => issue.severity === 'error')
      .length,
    csvSha256: createHash('sha256').update(documentPackage.csv).digest('hex'),
    reportSha256: createHash('sha256').update(documentPackage.reviewReportHtml).digest('hex'),
  });

  const rows: TaxDocumentRunRowWrite[] = documentPackage.rows.map((row) => ({
    formType: row.formType,
    payeeId: row.payeeId,
    recipientName: row.recipientName,
    recipientAddress: row.recipientAddress,
    recipientTinLastFour: row.recipientTinLastFour,
    accountReference: row.accountReference,
    grossAmount: row.grossAmount,
    transactionCount: row.transactionCount,
    federalWithholdingAmount: row.federalWithholdingAmount,
    boxes: row.boxes,
    isReportable: row.issues.every((issue) => issue.severity !== 'error'),
    validationErrors: row.issues,
    rowSha256: hashRow(row),
  }));

  try {
    await input.store.insertRows(run.runId, rows);
    await input.store.appendEvent({
      eventType: 'tax_document_run_created',
      runId: run.runId,
      actorUserId: input.actor.userId,
      eventPayload: {
        taxYear: documentPackage.taxYear,
        policyVersion: documentPackage.policyVersion,
        rowCount: documentPackage.rows.length,
        validationErrorCount: documentPackage.issues.filter((issue) => issue.severity === 'error')
          .length,
        filingStatus: documentPackage.manifest.filingStatus,
      },
    });
  } catch {
    await input.store.appendEvent({
      eventType: 'tax_document_run_failed',
      runId: run.runId,
      actorUserId: input.actor.userId,
      eventPayload: {
        taxYear: documentPackage.taxYear,
        policyVersion: documentPackage.policyVersion,
      },
    });
    throw new Error('The tax document run could not be persisted; no filing was performed.');
  }

  return { runId: run.runId, documentPackage };
}
