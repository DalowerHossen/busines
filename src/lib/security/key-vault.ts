// src/lib/security/key-vault.ts
// Database-backed secret storage. The database stores only an AES-GCM
// envelope; the master key is loaded from the server environment and is never
// accepted from a browser request.
import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { serverEnv } from '@/lib/env/env.server';
import { decryptSecret, encryptSecret, serializeSecretEnvelope } from './encryption';

const KEY_PATTERN = /^[a-z][a-z0-9_.-]{1,127}$/u;

export interface SecretStoreRecord {
  readonly id: string;
  readonly valueEncrypted: string;
}

export interface SecretStore {
  read(input: {
    readonly companyId: string | null;
    readonly key: string;
  }): Promise<SecretStoreRecord | null>;
  write(input: {
    readonly companyId: string | null;
    readonly key: string;
    readonly valueEncrypted: string;
  }): Promise<void>;
}

export interface KeyVaultInput {
  readonly masterKey: string;
  readonly keyVersion: string;
  readonly store: SecretStore;
}

export class KeyVaultError extends Error {
  readonly code: 'invalid_key_name' | 'missing_secret' | 'store_failed';

  constructor(code: KeyVaultError['code']) {
    super('Secret vault operation failed.');
    this.name = 'KeyVaultError';
    this.code = code;
  }
}

export class EncryptedKeyVault {
  private readonly masterKey: string;
  private readonly keyVersion: string;
  private readonly store: SecretStore;

  constructor(input: KeyVaultInput) {
    if (!input.masterKey || !input.keyVersion.trim()) throw new KeyVaultError('store_failed');
    this.masterKey = input.masterKey;
    this.keyVersion = input.keyVersion.trim();
    this.store = input.store;
  }

  async get(input: {
    readonly companyId: string | null;
    readonly key: string;
    readonly environmentFallback?: string;
  }): Promise<string | undefined> {
    validateKey(input.key);
    const record = await this.read(input.companyId, input.key);
    if (record) {
      return decryptSecret({
        envelope: record.valueEncrypted,
        base64Key: this.masterKey,
        expectedKeyVersion: this.keyVersion,
      });
    }
    return input.environmentFallback;
  }

  async getRequired(input: {
    readonly companyId: string | null;
    readonly key: string;
    readonly environmentFallback?: string;
  }): Promise<string> {
    const value = await this.get(input);
    if (!value) throw new KeyVaultError('missing_secret');
    return value;
  }

  async set(input: {
    readonly companyId: string | null;
    readonly key: string;
    readonly plaintext: string;
  }): Promise<void> {
    validateKey(input.key);
    if (!input.plaintext) throw new KeyVaultError('missing_secret');
    const envelope = encryptSecret({
      plaintext: input.plaintext,
      base64Key: this.masterKey,
      keyVersion: this.keyVersion,
    });
    try {
      await this.store.write({
        companyId: input.companyId,
        key: input.key,
        valueEncrypted: serializeSecretEnvelope(envelope),
      });
    } catch {
      throw new KeyVaultError('store_failed');
    }
  }

  private async read(companyId: string | null, key: string): Promise<SecretStoreRecord | null> {
    try {
      return await this.store.read({ companyId, key });
    } catch {
      throw new KeyVaultError('store_failed');
    }
  }
}

export function createDefaultKeyVault(): EncryptedKeyVault {
  return new EncryptedKeyVault({
    masterKey: serverEnv.ENCRYPTION_KEY,
    keyVersion: 'v1',
    store: createSupabaseSecretStore(createSupabaseAdminClient()),
  });
}

export function createSupabaseSecretStore(client: SupabaseClient): SecretStore {
  return {
    async read(input) {
      let query = client
        .from('system_settings')
        .select('id,value_encrypted,is_secret')
        .eq('scope', input.companyId === null ? 'platform' : 'company')
        .eq('key', input.key)
        .eq('is_secret', true)
        .limit(1);
      query =
        input.companyId === null
          ? query.is('company_id', null)
          : query.eq('company_id', input.companyId);
      const { data, error } = await query.maybeSingle();
      if (error) throw new Error('Secret store read failed.');
      if (!data || typeof data.id !== 'string' || typeof data.value_encrypted !== 'string')
        return null;
      return { id: data.id, valueEncrypted: data.value_encrypted };
    },
    async write(input) {
      const existing = await this.read({ companyId: input.companyId, key: input.key });
      if (existing) {
        const { error } = await client
          .from('system_settings')
          .update({ value_encrypted: input.valueEncrypted, value_plain: null, is_secret: true })
          .eq('id', existing.id);
        if (error) throw new Error('Secret store update failed.');
        return;
      }
      const { error } = await client.from('system_settings').insert({
        scope: input.companyId === null ? 'platform' : 'company',
        company_id: input.companyId,
        key: input.key,
        value_plain: null,
        value_encrypted: input.valueEncrypted,
        is_secret: true,
      });
      if (error) throw new Error('Secret store insert failed.');
    },
  };
}

function validateKey(key: string): void {
  if (!KEY_PATTERN.test(key)) throw new KeyVaultError('invalid_key_name');
}
