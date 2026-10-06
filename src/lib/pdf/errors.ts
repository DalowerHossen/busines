// src/lib/pdf/errors.ts
export type PdfErrorCode =
  | 'invalid_document'
  | 'unsupported_currency'
  | 'font_configuration_failed'
  | 'render_failed';

export class PdfRenderError extends Error {
  readonly code: PdfErrorCode;

  constructor(code: PdfErrorCode) {
    super('The document PDF could not be generated.');
    this.name = 'PdfRenderError';
    this.code = code;
  }
}
