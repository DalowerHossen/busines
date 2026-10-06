// src/lib/security/audit.ts
// Server-side audit event writer for application actions. Database triggers
// cover row mutations; this logger covers intent, authorization outcomes, and
// provider callbacks while redacting secret-like fields before persistence.
import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

const REDACTED_KEYS = new Set([
  'password',
  'secret',
  'token',
  'access_token',
  'refresh_token',
  'authorization',
  'cookie',
  'api_key',
  'private_key',
  'value_encrypted',
  'card_number',
  'pan',
  'cvv',
  'cvc',
]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export type AuditSeverity = 'info' | 'warning' | 'critical';

export interface AuditEventInput {
  readonly companyId: string | null;
  readonly actorUserId?: string | null;
  readonly action: string;
  readonly entityType: string;
  readonly entityId?: string | null;
  readonly severity?: AuditSeverity;
  readonly beforeData?: Readonly<Record<string, unknown>> | null;
  readonly afterData?: Readonly<Record<string, unknown>> | null;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly ipHash?: string | null;
  readonly userAgentHash?: string | null;
  readonly requestId?: string | null;
}

export interface AuditEventStore {
  append(input: {
    readonly company_id: string | null;
    readonly actor_user_id: string | null;
    readonly action: string;
    readonly entity_type: string;
    readonly entity_id: string | null;
    readonly severity: AuditSeverity;
    readonly before_data: Readonly<Record<string, unknown>> | null;
    readonly after_data: Readonly<Record<string, unknown>> | null;
    readonly metadata: Readonly<Record<string, unknown>>;
    readonly ip_hash: string | null;
    readonly user_agent_hash: string | null;
    readonly request_id: string | null;
  }): Promise<void>;
}

export async function recordAuditEvent(
  store: AuditEventStore,
  input: AuditEventInput
): Promise<void> {
  validateAuditInput(input);
  await store.append({
    company_id: input.companyId,
    actor_user_id: input.actorUserId ?? null,
    action: input.action.trim(),
    entity_type: input.entityType.trim(),
    entity_id: input.entityId ?? null,
    severity: input.severity ?? 'info',
    before_data: redactObject(input.beforeData ?? null),
    after_data: redactObject(input.afterData ?? null),
    metadata: redactObject(input.metadata ?? {}) ?? {},
    ip_hash: input.ipHash ?? null,
    user_agent_hash: input.userAgentHash ?? null,
    request_id: input.requestId ?? null,
  });
}

export function createSupabaseAuditStore(client: SupabaseClient): AuditEventStore {
  return {
    async append(input) {
      const { error } = await client.from('audit_logs').insert(input);
      if (error) throw new Error('Audit event could not be recorded.');
    },
  };
}

export function redactObject(
  value: Readonly<Record<string, unknown>> | null
): Readonly<Record<string, unknown>> | null {
  if (value === null) return null;
  const output: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    if (REDACTED_KEYS.has(key.toLowerCase())) {
      output[key] = '[REDACTED]';
    } else {
      output[key] = redactValue(nestedValue);
    }
  }
  return output;
}

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => redactValue(item));
  if (typeof value !== 'object' || value === null) return value;
  return redactObject(value as Readonly<Record<string, unknown>>);
}

function validateAuditInput(input: AuditEventInput): void {
  if (
    (input.companyId !== null && !UUID_PATTERN.test(input.companyId)) ||
    (input.actorUserId !== undefined &&
      input.actorUserId !== null &&
      !UUID_PATTERN.test(input.actorUserId)) ||
    (input.entityId !== undefined &&
      input.entityId !== null &&
      !UUID_PATTERN.test(input.entityId)) ||
    !/^[a-z][a-z0-9_.:-]{1,127}$/iu.test(input.action.trim()) ||
    !/^[a-z][a-z0-9_.:-]{1,127}$/iu.test(input.entityType.trim())
  ) {
    throw new Error('Audit event identifiers are invalid.');
  }
}
