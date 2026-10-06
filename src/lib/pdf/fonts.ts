// src/lib/pdf/fonts.ts
// The PDF renderer embeds these bundled DejaVu Sans files instead of relying
// on a host-installed font. DejaVu Sans covers the Latin, Greek, Cyrillic,
// punctuation, and symbol ranges commonly used in invoices and supports
// Unicode text without browser-only font fallbacks.
import 'server-only';

import { existsSync } from 'node:fs';
import path from 'node:path';

import { Font } from '@react-pdf/renderer';

import { PdfRenderError } from './errors';

export const PDF_FONT_FAMILY = 'KDInvoiceSans';

let fontsRegistered = false;

export function ensurePdfFontsRegistered(): void {
  if (fontsRegistered) return;

  const fontDirectory = path.join(process.cwd(), 'public', 'fonts');
  const regular = path.join(fontDirectory, 'DejaVuSans.ttf');
  const bold = path.join(fontDirectory, 'DejaVuSans-Bold.ttf');
  if (!existsSync(regular) || !existsSync(bold)) {
    throw new PdfRenderError('font_configuration_failed');
  }

  try {
    Font.register({
      family: PDF_FONT_FAMILY,
      fonts: [
        { src: regular, fontStyle: 'normal', fontWeight: 400 },
        { src: bold, fontStyle: 'normal', fontWeight: 700 },
      ],
    });
    fontsRegistered = true;
  } catch {
    throw new PdfRenderError('font_configuration_failed');
  }
}
