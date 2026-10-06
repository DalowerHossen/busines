// src/lib/media/errors.ts
export type MediaErrorCode =
  | 'invalid_file'
  | 'unsupported_file_type'
  | 'file_too_large'
  | 'unsafe_file_content'
  | 'optimization_failed';

export class MediaProcessingError extends Error {
  readonly code: MediaErrorCode;

  constructor(code: MediaErrorCode) {
    super('The uploaded file could not be processed safely.');
    this.name = 'MediaProcessingError';
    this.code = code;
  }
}
