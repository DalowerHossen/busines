// src/lib/audit/record.ts
// Writing to the audit trail from the application. Row changes are already
// captured by database triggers; these helpers record the events that have no
// row behind them, such as a sign in, an export or reading a protected field.

import 'server-only';

import { logger } from '@/lib/logger';
import { getRequestContext } from '@/lib/security/request-context';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getServiceSupabaseClient } from '@/lib/supabase/service';
import type { AuditAction } from '@/types/enums';
import type { Json } from '@/types/json';

export interface AuditEntryInput {
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  companyId?: string | null;
  description?: string | null;
  metadata?: Record<string, Json>;
}

/**
 * Appends an entry to the audit trail on behalf of the signed in account.
 *
 * Failing to write an audit entry must never break the action the user asked
 * for, so the failure is logged and swallowed.
 *
 * @param entry What happened.
 * @returns The identifier of the entry, or null when it could not be written.
 */
export async function recordAuditEntry(entry: AuditEntryInput): Promise<string | null> {
  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase.rpc('record_manual_audit_entry', {
      p_action: entry.action,
      p_entity_type: entry.entityType,
      p_entity_id: entry.entityId ?? null,
      p_company_id: entry.companyId ?? null,
      p_description: entry.description ?? null,
      p_metadata: entry.metadata ?? {},
    });

    if (error) {
      throw error;
    }

    return typeof data === 'string' ? data : null;
  } catch (caught) {
    logger.error('An audit entry could not be written', caught, {
      action: entry.action,
      entityType: entry.entityType,
    });

    return null;
  }
}

/**
 * Appends an entry from a background job, where there is no session.
 *
 * @param entry What happened.
 * @returns The identifier of the entry, or null when it could not be written.
 */
export async function recordSystemAuditEntry(entry: AuditEntryInput): Promise<string | null> {
  try {
    const supabase = getServiceSupabaseClient();
    const { data, error } = await supabase.rpc('record_manual_audit_entry', {
      p_action: entry.action,
      p_entity_type: entry.entityType,
      p_entity_id: entry.entityId ?? null,
      p_company_id: entry.companyId ?? null,
      p_description: entry.description ?? null,
      p_metadata: entry.metadata ?? {},
    });

    if (error) {
      throw error;
    }

    return typeof data === 'string' ? data : null;
  } catch (caught) {
    logger.error('A system audit entry could not be written', caught, {
      action: entry.action,
      entityType: entry.entityType,
    });

    return null;
  }
}

export interface SensitiveReadInput {
  companyId: string;
  resourceType: string;
  resourceId?: string | null;
  fieldName?: string | null;
  purpose?: string | null;
}

/**
 * Records that somebody read protected personal or financial data.
 *
 * @param read What was looked at and why.
 * @returns The identifier of the entry, or null when it could not be written.
 */
export async function recordSensitiveRead(read: SensitiveReadInput): Promise<string | null> {
  try {
    const context = getRequestContext();
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase.rpc('record_sensitive_access', {
      p_company_id: read.companyId,
      p_resource_type: read.resourceType,
      p_resource_id: read.resourceId ?? null,
      p_field_name: read.fieldName ?? null,
      p_purpose: read.purpose ?? null,
      p_ip_hash: context.ipHash,
      p_user_agent: context.userAgent,
    });

    if (error) {
      throw error;
    }

    return typeof data === 'string' ? data : null;
  } catch (caught) {
    logger.error('A sensitive read could not be recorded', caught, {
      resourceType: read.resourceType,
    });

    return null;
  }
}
