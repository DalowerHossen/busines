// src/lib/media/index.ts
import 'server-only';

export { MediaProcessingError } from './errors';
export { serializeCsv } from './csv';
export {
  DEFAULT_MAX_UPLOAD_BYTES,
  FILE_SIZE_LIMITS,
  detectFileKind,
  validateUploadedFile,
} from './file-validator';
export { sanitizeRichText, sanitizeSvgMarkup } from './html-sanitizer';
export { compressPdf, optimizeImage, optimizeMedia } from './optimizer';
export { parseTabularFile } from './tabular';
export type { FileValidationInput, ValidatedFile, ValidatedFileKind } from './file-validator';
export type { HtmlSanitizeOptions } from './html-sanitizer';
export type { MediaOptimizationOptions, OptimizedImageFormat, OptimizedMedia } from './optimizer';
export type { ParsedTabularFile, TabularParseOptions } from './tabular';
