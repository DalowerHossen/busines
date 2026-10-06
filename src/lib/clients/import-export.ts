import 'server-only';

import { clientImportSchema } from '@/lib/validators/client';
import type { Client } from '@/types/client';
import type { FileValidationInput } from '@/lib/media/file-validator';
import { parseTabularFile, serializeCsv } from '@/lib/media';
import {
  clientExportFailed,
  clientImportFailed,
  duplicateClient,
  invalidClientRequest,
} from './errors';
import { createClient } from './service';
import type { ClientActor, ClientEditableFields, ClientStore } from './types';

export const CLIENT_EXPORT_HEADERS = [
  'Display name',
  'Email',
  'Phone',
  'Company name on invoice',
  'Tax ID',
  'Default currency',
  'Group ID',
  'Tag IDs',
  'Notes',
  'Status',
] as const;

export interface ClientImportResult {
  readonly imported: number;
  readonly clients: readonly Client[];
}

export interface ClientExportOptions {
  readonly includeArchived?: boolean;
}

export async function importClientsFromTabularFile(input: {
  readonly actor: ClientActor;
  readonly file: FileValidationInput;
  readonly store: ClientStore;
}): Promise<ClientImportResult> {
  if (input.actor.role !== 'owner' && input.actor.role !== 'staff') {
    throw clientImportFailed();
  }
  const parsed = await parseTabularFile(input.file, {
    maxRows: 10_000,
    maxColumns: 20,
    maxCellCharacters: 10_000,
  }).catch(() => {
    throw clientImportFailed();
  });
  const rows = parseImportRows(parsed.headers, parsed.rows);
  const existing = await input.store.list({
    companyId: input.actor.companyId,
    includeArchived: true,
  });
  assertNoDuplicateRows(rows, existing);

  const clients: Client[] = [];
  for (const data of rows) {
    try {
      clients.push(await createClient({ actor: input.actor, data, store: input.store }));
    } catch (error) {
      if (error instanceof Error && 'code' in error) throw error;
      throw clientImportFailed();
    }
  }
  return { imported: clients.length, clients };
}

export function exportClientsToCsv(
  clients: readonly Client[],
  options: ClientExportOptions = {}
): string {
  try {
    const rows = clients
      .filter((client) => options.includeArchived || !client.isArchived)
      .map((client) => ({
        'Display name': client.displayName,
        Email: client.email,
        Phone: client.phone,
        'Company name on invoice': client.companyNameOnInvoice,
        'Tax ID': client.taxId,
        'Default currency': client.defaultCurrency,
        'Group ID': client.groupId,
        'Tag IDs': client.tagIds.join(', '),
        Notes: client.notes,
        Status: client.isArchived ? 'Archived' : 'Active',
      }));
    return serializeCsv(CLIENT_EXPORT_HEADERS, rows);
  } catch {
    throw clientExportFailed();
  }
}

function parseImportRows(
  headers: readonly string[],
  rows: readonly Readonly<Record<string, string>>[]
): readonly ClientEditableFields[] {
  const headerMap = new Map(headers.map((header) => [normalizeHeader(header), header]));
  const displayNameHeader = findHeader(headerMap, ['displayname', 'name']);
  const emailHeader = findHeader(headerMap, ['email', 'emailaddress']);
  const phoneHeader = findHeader(headerMap, ['phone', 'phonenumber']);
  const currencyHeader = findHeader(headerMap, ['defaultcurrency', 'currency']);
  if (!displayNameHeader || !emailHeader || !currencyHeader) throw clientImportFailed();

  const parsedRows = rows.map((row) => {
    const candidate = {
      displayName: row[displayNameHeader] ?? '',
      email: row[emailHeader] ?? '',
      phone: phoneHeader ? row[phoneHeader] || null : null,
      defaultCurrency: row[currencyHeader] ?? '',
      billingAddress: null,
    };
    const result = clientImportSchema.shape.rows.element.safeParse(candidate);
    if (!result.success) throw invalidClientRequest();
    return {
      displayName: result.data.displayName,
      email: result.data.email,
      phone: result.data.phone ?? null,
      companyNameOnInvoice: null,
      billingAddress: null,
      shippingAddress: null,
      taxId: null,
      defaultCurrency: result.data.defaultCurrency,
      groupId: null,
      tagIds: [],
      notes: null,
    } satisfies ClientEditableFields;
  });
  if (parsedRows.length === 0) throw clientImportFailed();
  return parsedRows;
}

function assertNoDuplicateRows(
  rows: readonly ClientEditableFields[],
  existing: readonly Client[]
): void {
  const seenEmails = new Set<string>();
  const seenPhones = new Set<string>();
  for (const row of rows) {
    const email = normalizeEmail(row.email);
    const phone = normalizePhone(row.phone);
    if (
      seenEmails.has(email) ||
      existing.some((client) => normalizeEmail(client.email) === email)
    ) {
      throw duplicateClient();
    }
    if (
      phone &&
      (seenPhones.has(phone) || existing.some((client) => normalizePhone(client.phone) === phone))
    ) {
      throw duplicateClient();
    }
    seenEmails.add(email);
    if (phone) seenPhones.add(phone);
  }
}

function findHeader(
  headerMap: ReadonlyMap<string, string>,
  aliases: readonly string[]
): string | null {
  for (const alias of aliases) {
    const header = headerMap.get(alias);
    if (header) return header;
  }
  return null;
}

function normalizeHeader(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9]/gu, '');
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizePhone(value: string | null): string {
  return value ? value.replace(/\D/gu, '') : '';
}
