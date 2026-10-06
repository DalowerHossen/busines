// src/features/reports/validation/report.ts
// What a valid report request looks like: a known report, a period that runs
// forwards, and a download format.

import { z } from 'zod';

import { REPORT_DEFINITIONS } from '@/features/reports/registry';
import { isoDateSchema } from '@/lib/validation/primitives';

const reportKeys = REPORT_DEFINITIONS.map((report) => report.key);

export const reportPeriodSchema = z
  .object({
    fromDate: isoDateSchema,
    toDate: isoDateSchema,
  })
  .superRefine((value, context) => {
    if (value.toDate < value.fromDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['toDate'],
        message: 'The end of the period cannot fall before the start.',
      });
    }
  });

export const reportRequestSchema = z
  .object({
    reportKey: z.string().refine((value) => reportKeys.includes(value), 'Unknown report.'),
    fromDate: isoDateSchema,
    toDate: isoDateSchema,
    format: z.enum(['csv', 'pdf']).default('csv'),
  })
  .superRefine((value, context) => {
    if (value.toDate < value.fromDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['toDate'],
        message: 'The end of the period cannot fall before the start.',
      });
    }
  });

export type ReportRequestInput = z.input<typeof reportRequestSchema>;
