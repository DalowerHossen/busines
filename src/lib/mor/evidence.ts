import 'server-only';

import type { StorageAdapter, StorageFileMetadata } from '@/types/storage';
import { invalidMorRequest } from './errors';
import type { EvidencePackBundle } from './types';

export * from './evidence-core';

export async function storeDisputeEvidencePack(input: {
  readonly bundle: EvidencePackBundle;
  readonly storage: StorageAdapter;
  readonly companyId: string;
  readonly fileName?: string;
}): Promise<StorageFileMetadata> {
  if (!input.companyId.trim()) throw invalidMorRequest();
  const content = Buffer.from(input.bundle.canonicalJson, 'utf8');
  return input.storage.uploadFile({
    companyId: input.companyId,
    category: 'other',
    fileName: input.fileName ?? `dispute-evidence-${input.bundle.contentSha256}.json`,
    mimeType: 'application/json',
    sizeInBytes: content.byteLength,
    content,
    visibility: 'private',
  });
}
