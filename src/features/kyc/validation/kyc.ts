// src/features/kyc/validation/kyc.ts
// What a business must tell us before we will collect money on its behalf.

import { z } from 'zod';

import {
  countryCodeSchema,
  emailSchema,
  isoDateSchema,
  moneySchema,
  uuidSchema,
} from '@/lib/validation/primitives';
import { KYC_DOCUMENT_SIDES, KYC_DOCUMENT_TYPES, LEGAL_ENTITY_TYPES } from '@/features/kyc/types';

/** Empty text is kept as nothing rather than an empty string. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null));

export const saveVerificationSchema = z.object({
  verificationId: uuidSchema.optional(),
  legalEntityType: z.enum(LEGAL_ENTITY_TYPES),
  legalName: z
    .string()
    .trim()
    .min(2, 'Enter the name exactly as it is registered.')
    .max(200, 'Keep the name under 200 characters.'),
  registrationNumber: optionalText(60),
  taxIdentificationNumber: optionalText(60),
  incorporationCountry: countryCodeSchema,
  incorporationDate: isoDateSchema.optional(),
  representativeName: z
    .string()
    .trim()
    .min(2, 'Enter the full name of the person answering for the business.')
    .max(160, 'Keep the name under 160 characters.'),
  representativeRole: optionalText(80),
  representativeEmail: emailSchema,
  representativePhone: optionalText(40),
  representativeDateOfBirth: isoDateSchema.optional(),
  registeredAddressLine1: optionalText(160),
  registeredAddressLine2: optionalText(160),
  registeredCity: optionalText(80),
  registeredRegion: optionalText(80),
  registeredPostalCode: optionalText(20),
  registeredCountry: countryCodeSchema,
  businessDescription: optionalText(600),
  expectedMonthlyVolume: moneySchema.optional(),
  website: optionalText(200),
});

export type SaveVerificationInput = z.infer<typeof saveVerificationSchema>;

export const submitVerificationSchema = z.object({
  verificationId: uuidSchema,
});

export type SubmitVerificationInput = z.infer<typeof submitVerificationSchema>;

export const removeDocumentSchema = z.object({
  documentId: uuidSchema,
});

export type RemoveDocumentInput = z.infer<typeof removeDocumentSchema>;

export const uploadDocumentSchema = z.object({
  verificationId: uuidSchema,
  documentType: z.enum(KYC_DOCUMENT_TYPES),
  documentSide: z.enum(KYC_DOCUMENT_SIDES),
  documentNumber: optionalText(60),
  issuingCountry: countryCodeSchema.optional(),
  expiresOn: isoDateSchema.optional(),
});

export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;

export const reviewVerificationSchema = z
  .object({
    verificationId: uuidSchema,
    isApproved: z.boolean(),
    note: optionalText(300),
    validMonths: z.coerce.number().int().min(1).max(60).default(24),
  })
  .refine((value) => value.isApproved || (value.note !== null && value.note.length >= 3), {
    message: 'Say what is missing before refusing a check.',
    path: ['note'],
  });

export type ReviewVerificationInput = z.infer<typeof reviewVerificationSchema>;
