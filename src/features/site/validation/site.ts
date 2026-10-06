// src/features/site/validation/site.ts
// What may be typed into the website editor.

import { z } from 'zod';

import { uuidSchema } from '@/lib/validation/primitives';

export const PAGE_TYPES = ['marketing', 'legal', 'help', 'blog', 'landing'] as const;

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9]+(-[a-z0-9]+)*(\/[a-z0-9]+(-[a-z0-9]+)*)*$/,
    'Use lower case words separated by hyphens, such as invoicing-for-freelancers.'
  );

const pathSchema = z
  .string()
  .trim()
  .regex(/^\/[A-Za-z0-9._~/-]*$/, 'Enter an address beginning with a slash.');

export const savePageSchema = z.object({
  pageId: uuidSchema.optional(),
  slug: slugSchema,
  title: z
    .string()
    .trim()
    .min(2, 'Give the page a title.')
    .max(160, 'Keep the title under one hundred and sixty characters.'),
  pageType: z.enum(PAGE_TYPES),
  excerpt: z.string().trim().max(300).optional(),
  metaTitle: z
    .string()
    .trim()
    .min(10, 'A title for search results needs at least ten characters.')
    .max(70, 'Search engines cut a title off after seventy characters.')
    .optional(),
  metaDescription: z
    .string()
    .trim()
    .min(50, 'A description under fifty characters tells a reader nothing.')
    .max(160, 'Search engines cut a description off after one hundred and sixty characters.')
    .optional(),
  robotsDirective: z.enum(['index,follow', 'index,nofollow', 'noindex,follow', 'noindex,nofollow']),
  showInNavigation: z.boolean().default(false),
  navigationOrder: z.coerce.number().int().min(0).max(999).default(100),
});

export const pageStateSchema = z.object({
  pageId: uuidSchema,
  isPublished: z.boolean(),
});

export const pageIdSchema = z.object({
  pageId: uuidSchema,
});

export const saveRedirectSchema = z.object({
  sourcePath: pathSchema,
  targetPath: z
    .string()
    .trim()
    .regex(
      /^(\/[A-Za-z0-9._~/-]*|https:\/\/[A-Za-z0-9.-]+(\/.*)?)$/,
      'Enter an address on this site, or a full secure web address.'
    ),
  statusCode: z.coerce
    .number()
    .int()
    .refine((value) => [301, 302, 307, 308].includes(value), {
      message: 'Choose one of the usual redirect codes.',
    }),
  reason: z.string().trim().max(200).optional(),
});

export const redirectIdSchema = z.object({
  redirectId: uuidSchema,
});
