// src/lib/media/optimizer.ts
// Server-only image/PDF optimization. Images are decoded and re-encoded so
// hostile metadata and active SVG content are not passed through unchanged;
// PDFs are re-saved with object streams while preserving page content.
import 'server-only';

import crypto from 'node:crypto';

import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';

import { sanitizeSvgMarkup } from './html-sanitizer';
import { MediaProcessingError } from './errors';
import {
  validateUploadedFile,
  type FileValidationInput,
  type ValidatedFileKind,
} from './file-validator';

export type OptimizedImageFormat = 'jpeg' | 'png' | 'webp';

export interface MediaOptimizationOptions {
  readonly maxWidth?: number;
  readonly maxHeight?: number;
  readonly quality?: number;
  readonly imageFormat?: OptimizedImageFormat;
  readonly maxPixels?: number;
}

export interface OptimizedMedia {
  readonly content: Buffer;
  readonly fileName: string;
  readonly mimeType: string;
  readonly kind: 'image' | 'pdf';
  readonly originalSizeInBytes: number;
  readonly sizeInBytes: number;
  readonly sha256: string;
  readonly width: number | null;
  readonly height: number | null;
  readonly pageCount: number | null;
}

const DEFAULT_MAX_WIDTH = 2_400;
const DEFAULT_MAX_HEIGHT = 2_400;
const DEFAULT_QUALITY = 82;
const DEFAULT_MAX_PIXELS = 40_000_000;

function assertPositiveInteger(value: number, code: 'invalid_file' | 'optimization_failed'): void {
  if (!Number.isSafeInteger(value) || value <= 0) throw new MediaProcessingError(code);
}

function outputFileName(fileName: string, extension: string): string {
  const withoutExtension = fileName.replace(/\.[a-z0-9]{1,8}$/iu, '');
  return `${withoutExtension}.${extension}`;
}

function hash(content: Buffer): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function getImageOutput(
  sourceKind: ValidatedFileKind,
  requestedFormat: OptimizedImageFormat | undefined
): {
  readonly format: OptimizedImageFormat;
  readonly mimeType: string;
  readonly extension: string;
} {
  if (sourceKind === 'svg') return { format: 'png', mimeType: 'image/png', extension: 'png' };
  const format = requestedFormat ?? (sourceKind === 'jpeg' ? 'jpeg' : 'webp');
  return {
    format,
    mimeType: format === 'jpeg' ? 'image/jpeg' : `image/${format}`,
    extension: format === 'jpeg' ? 'jpg' : format,
  };
}

function assertImageOptions(
  options: Required<
    Pick<MediaOptimizationOptions, 'maxWidth' | 'maxHeight' | 'quality' | 'maxPixels'>
  >
): void {
  assertPositiveInteger(options.maxWidth, 'invalid_file');
  assertPositiveInteger(options.maxHeight, 'invalid_file');
  assertPositiveInteger(options.maxPixels, 'invalid_file');
  if (options.quality < 1 || options.quality > 100) {
    throw new MediaProcessingError('invalid_file');
  }
}

async function optimizeImageFile(
  validated: Awaited<ReturnType<typeof validateUploadedFile>>,
  options: MediaOptimizationOptions
): Promise<OptimizedMedia> {
  const settings = {
    maxHeight: options.maxHeight ?? DEFAULT_MAX_HEIGHT,
    maxPixels: options.maxPixels ?? DEFAULT_MAX_PIXELS,
    maxWidth: options.maxWidth ?? DEFAULT_MAX_WIDTH,
    quality: options.quality ?? DEFAULT_QUALITY,
  };
  assertImageOptions(settings);

  let source = validated.content;
  if (validated.kind === 'svg') {
    source = Buffer.from(sanitizeSvgMarkup(source.toString('utf8')));
  }
  if (validated.kind === 'gif') {
    const metadata = await sharp(source, { limitInputPixels: settings.maxPixels }).metadata();
    if ((metadata.pages ?? 1) > 1) throw new MediaProcessingError('unsafe_file_content');
  }

  const metadata = await sharp(source, { limitInputPixels: settings.maxPixels }).metadata();
  const output = getImageOutput(validated.kind, options.imageFormat);
  try {
    let pipeline = sharp(source, { failOn: 'error', limitInputPixels: settings.maxPixels })
      .rotate()
      .resize({
        fit: 'inside',
        height: settings.maxHeight,
        withoutEnlargement: true,
        width: settings.maxWidth,
      });
    if (output.format === 'jpeg') {
      pipeline = pipeline.jpeg({ quality: settings.quality, progressive: true });
    } else if (output.format === 'png') {
      pipeline = pipeline.png({ compressionLevel: 9, effort: 8, palette: true });
    } else {
      pipeline = pipeline.webp({ effort: 5, quality: settings.quality });
    }
    const content = await pipeline.toBuffer();
    return {
      content,
      fileName: outputFileName(validated.fileName, output.extension),
      mimeType: output.mimeType,
      kind: 'image',
      originalSizeInBytes: validated.sizeInBytes,
      sizeInBytes: content.byteLength,
      sha256: hash(content),
      width: metadata.width ?? null,
      height: metadata.height ?? null,
      pageCount: null,
    };
  } catch (error) {
    if (error instanceof MediaProcessingError) throw error;
    throw new MediaProcessingError('optimization_failed');
  }
}

async function optimizePdfFile(
  validated: Awaited<ReturnType<typeof validateUploadedFile>>
): Promise<OptimizedMedia> {
  try {
    const document = await PDFDocument.load(validated.content, {
      ignoreEncryption: false,
      updateMetadata: false,
    });
    const content = Buffer.from(
      await document.save({
        addDefaultPage: false,
        objectsPerTick: 50,
        useObjectStreams: true,
        updateFieldAppearances: false,
      })
    );
    return {
      content,
      fileName: outputFileName(validated.fileName, 'pdf'),
      mimeType: 'application/pdf',
      kind: 'pdf',
      originalSizeInBytes: validated.sizeInBytes,
      sizeInBytes: content.byteLength,
      sha256: hash(content),
      width: null,
      height: null,
      pageCount: document.getPageCount(),
    };
  } catch {
    throw new MediaProcessingError('optimization_failed');
  }
}

export async function optimizeMedia(
  input: FileValidationInput,
  options: MediaOptimizationOptions = {}
): Promise<OptimizedMedia> {
  const validated = await validateUploadedFile(input);
  if (validated.kind === 'pdf') return optimizePdfFile(validated);
  if (['png', 'jpeg', 'webp', 'gif', 'svg'].includes(validated.kind)) {
    return optimizeImageFile(validated, options);
  }
  throw new MediaProcessingError('unsupported_file_type');
}

export async function optimizeImage(
  input: FileValidationInput,
  options: MediaOptimizationOptions = {}
): Promise<OptimizedMedia> {
  const validated = await validateUploadedFile(input);
  if (!['png', 'jpeg', 'webp', 'gif', 'svg'].includes(validated.kind)) {
    throw new MediaProcessingError('unsupported_file_type');
  }
  return optimizeImageFile(validated, options);
}

export async function compressPdf(input: FileValidationInput): Promise<OptimizedMedia> {
  const validated = await validateUploadedFile(input);
  if (validated.kind !== 'pdf') throw new MediaProcessingError('unsupported_file_type');
  return optimizePdfFile(validated);
}
