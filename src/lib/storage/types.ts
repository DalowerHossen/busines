// src/lib/storage/types.ts
// What every place a file can live has to be able to do.
//
// The rest of the application never learns whether a file sits in an object
// store, in a managed bucket or on the disk of a self hosted box. It asks
// for somewhere to upload to and for a way to read the bytes back, and this
// interface is the whole of what it may rely on.

import 'server-only';

import type { JsonObject } from '@/types/json';

export type StorageProviderKey =
  | 'supabase'
  | 'google_drive'
  | 'cloudflare_r2'
  | 'aws_s3'
  | 'backblaze_b2'
  | 'wasabi'
  | 'local_disk';

export interface StorageTargetConfig {
  targetId: string;
  /** Folder every key of this tenant sits under, when the store uses one. */
  pathPrefix: string | null;
  provider: StorageProviderKey;
  bucketName: string;
  region: string | null;
  endpointUrl: string | null;
  publicBaseUrl: string | null;
  forcePathStyle: boolean;
  signedUrlTtlSeconds: number;
  /** Credentials in clear text, decrypted for this call only. */
  credentials: Readonly<Record<string, string>>;
}

export interface UploadInstruction {
  /** Where the browser should send the bytes. */
  url: string;
  /** Method the browser should use. */
  method: 'PUT' | 'POST';
  /** Headers the browser has to repeat for the signature to hold. */
  headers: Readonly<Record<string, string>>;
  /** When the instruction stops working. */
  expiresAt: string;
}

export interface StorageHealth {
  /** True when the store answered as expected. */
  isHealthy: boolean;
  /** A sentence an administrator can act on. */
  message: string;
}

export interface StorageAdapter {
  /** Name used in logs and on the administration screen. */
  readonly key: StorageProviderKey;

  /**
   * Builds the instruction a browser uses to upload one object directly.
   *
   * @param target Store being written to.
   * @param storageKey Key the object will be written under.
   * @param mimeType Type of the object being uploaded.
   * @returns Where and how the browser should send the bytes.
   */
  createUploadInstruction(
    target: StorageTargetConfig,
    storageKey: string,
    mimeType: string
  ): Promise<UploadInstruction>;

  /**
   * Builds a short lived address the bytes can be read from.
   *
   * @param target Store being read from.
   * @param storageKey Key of the object.
   * @param downloadName Name the browser should save the file as.
   * @returns An address that works until it expires.
   */
  createDownloadUrl(
    target: StorageTargetConfig,
    storageKey: string,
    downloadName: string | null
  ): Promise<string>;

  /**
   * Removes one object from the store.
   *
   * @param target Store holding the object.
   * @param storageKey Key of the object.
   * @returns True when the object is gone.
   */
  removeObject(target: StorageTargetConfig, storageKey: string): Promise<boolean>;

  /**
   * Checks the settings without moving a file.
   *
   * @param target Store being checked.
   * @returns Whether the store answered as expected.
   */
  checkHealth(target: StorageTargetConfig): Promise<StorageHealth>;

  /**
   * Reads the bytes back through this application, for stores that serve no
   * address of their own.
   *
   * @param target Store holding the object.
   * @param objectReference Identifier the store gave the object, or our key.
   * @returns The response carrying the bytes, or null when it is not there.
   */
  streamObject?(target: StorageTargetConfig, objectReference: string): Promise<Response | null>;
}

export interface StorageTargetRecord extends StorageTargetConfig {
  /** Extra fields the administration screen shows. */
  details: JsonObject;
}
