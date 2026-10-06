// src/lib/ocr/registry.ts
// Which reader handles a receipt. The list is kept here so adding a second
// reader never means hunting through the worker.

import 'server-only';

import { configurableReceiptReader } from '@/lib/ocr/configurable-reader';
import type { ReceiptReader } from '@/lib/ocr/types';

const READERS: readonly ReceiptReader[] = [configurableReceiptReader];

/**
 * Finds the reader with a given name.
 *
 * @param key Name stored in the settings, such as configurable.
 * @returns The reader, or the first one when the name is unknown.
 */
export function resolveReceiptReader(key: string | null): ReceiptReader {
  const match = READERS.find((reader) => reader.key === key);

  return match ?? configurableReceiptReader;
}

/**
 * Lists every reader the platform knows about.
 *
 * @returns The names, for a settings screen to offer.
 */
export function listReceiptReaders(): readonly string[] {
  return READERS.map((reader) => reader.key);
}
