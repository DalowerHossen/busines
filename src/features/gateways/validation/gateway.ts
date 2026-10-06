// src/features/gateways/validation/gateway.ts
// What a valid payment connection looks like.

import { z } from 'zod';

import { uuidSchema } from '@/lib/validation/primitives';
import { GATEWAY_MODES, GATEWAY_PROVIDERS } from '@/types/enums';

const jsonObject = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : '{}'))
  .refine((value) => {
    try {
      const parsed: unknown = JSON.parse(value);
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed);
    } catch {
      return false;
    }
  }, 'Write the configuration as a JSON object, such as a test_url entry holding the address we should call.');

export const saveGatewaySchema = z.object({
  gatewayId: uuidSchema.optional(),
  provider: z.enum(GATEWAY_PROVIDERS),
  displayName: z
    .string()
    .trim()
    .min(1, 'Give this connection a name you will recognise.')
    .max(80, 'Keep the name under 80 characters.'),
  mode: z.enum(GATEWAY_MODES),
  credentials: z.record(z.string(), z.string()).default({}),
  publishableKey: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
  instructions: z
    .string()
    .trim()
    .max(600)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
  adapterConfig: jsonObject,
  feePercentage: z
    .union([z.string().trim(), z.number()])
    .optional()
    .transform((value) => (value === undefined || value === '' ? '0' : String(value)))
    .refine((value) => {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100;
    }, 'Enter a percentage between 0 and 100.'),
  feeFixedAmount: z
    .union([z.string().trim(), z.number()])
    .optional()
    .transform((value) => (value === undefined || value === '' ? '0' : String(value)))
    .refine((value) => {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) && parsed >= 0;
    }, 'Enter an amount of zero or more.'),
});

export const gatewayIdSchema = z.object({ gatewayId: uuidSchema });

export const setGatewayStateSchema = z.object({
  gatewayId: uuidSchema,
  isEnabled: z.boolean().optional(),
  makeDefault: z.boolean().optional(),
});

export type SaveGatewayInput = z.input<typeof saveGatewaySchema>;
export type SetGatewayStateInput = z.input<typeof setGatewayStateSchema>;
