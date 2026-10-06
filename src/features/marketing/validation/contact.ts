// src/features/marketing/validation/contact.ts
// What the public forms accept. The same schemas validate a form post and a
// direct call, so the rules cannot drift apart.

import { z } from 'zod';

import { emailSchema } from '@/lib/validation/primitives';

export const CONTACT_TOPICS = [
  { value: 'sales', label: 'Choosing a plan' },
  { value: 'support', label: 'Help with my account' },
  { value: 'billing', label: 'Billing or invoices' },
  { value: 'partnership', label: 'Partnership or reselling' },
  { value: 'other', label: 'Something else' },
] as const;

export type ContactTopic = (typeof CONTACT_TOPICS)[number]['value'];

const topicValues = CONTACT_TOPICS.map((topic) => topic.value) as [ContactTopic, ...ContactTopic[]];

export const contactMessageSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Enter your name.')
    .max(120, 'That name is longer than we can store.'),
  email: emailSchema,
  companyName: z
    .string()
    .trim()
    .max(160, 'That company name is longer than we can store.')
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
  topic: z.enum(topicValues, { errorMap: () => ({ message: 'Choose what this is about.' }) }),
  message: z
    .string()
    .trim()
    .min(20, 'Tell us a little more, at least twenty characters.')
    .max(4000, 'Please keep the message under four thousand characters.'),
  acceptsPrivacyPolicy: z.literal(true, {
    errorMap: () => ({ message: 'Please confirm you have read the privacy policy.' }),
  }),
  /** Left empty by a person and filled in by a robot. */
  website: z
    .string()
    .max(0, 'This field must stay empty.')
    .optional()
    .transform(() => null),
});

export type ContactMessageInput = z.input<typeof contactMessageSchema>;
export type ContactMessage = z.output<typeof contactMessageSchema>;

export const consentDecisionSchema = z.object({
  analytics: z.boolean(),
  marketing: z.boolean(),
  preferences: z.boolean(),
});

export type ConsentDecisionInput = z.infer<typeof consentDecisionSchema>;
