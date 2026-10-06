// src/lib/media/html-sanitizer.ts
// Allow-list HTML sanitization for rich text and document templates. Inline
// styles, forms, embeds, SVG, event handlers, and all unknown tags are
// removed; links are constrained to safe schemes and opened safely.
import 'server-only';

import sanitizeHtml from 'sanitize-html';

import { MediaProcessingError } from './errors';

const RICH_TEXT_TAGS = [
  'a',
  'blockquote',
  'br',
  'code',
  'em',
  'h2',
  'h3',
  'li',
  'ol',
  'p',
  'pre',
  'strong',
  'ul',
];

const RICH_TEXT_ATTRIBUTES = {
  a: ['href', 'target', 'rel'],
};

const SAFE_SCHEMES = ['http', 'https', 'mailto'];

export interface HtmlSanitizeOptions {
  readonly maxCharacters?: number;
}

function assertString(value: string, maxCharacters: number): string {
  if (typeof value !== 'string' || value.length > maxCharacters) {
    throw new MediaProcessingError('invalid_file');
  }
  return value.normalize('NFKC');
}

export function sanitizeRichText(value: string, options: HtmlSanitizeOptions = {}): string {
  const input = assertString(value, options.maxCharacters ?? 200_000);
  return sanitizeHtml(input, {
    allowedAttributes: RICH_TEXT_ATTRIBUTES,
    allowedSchemes: SAFE_SCHEMES,
    allowedSchemesByTag: { a: SAFE_SCHEMES },
    allowedTags: RICH_TEXT_TAGS,
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    enforceHtmlBoundary: true,
    transformTags: {
      a: (_tagName, attributes) => ({
        attribs: {
          href: attributes.href ?? '',
          rel: 'noopener noreferrer',
          target: '_blank',
        },
        tagName: 'a',
      }),
    },
  });
}

export function sanitizeSvgMarkup(value: string, options: HtmlSanitizeOptions = {}): string {
  const input = assertString(value, options.maxCharacters ?? 2_000_000);
  const sanitized = sanitizeHtml(input, {
    allowedAttributes: {
      circle: ['cx', 'cy', 'fill', 'r', 'stroke', 'stroke-width'],
      ellipse: ['cx', 'cy', 'fill', 'rx', 'ry', 'stroke', 'stroke-width'],
      g: ['fill', 'stroke', 'stroke-width', 'transform'],
      line: ['fill', 'stroke', 'stroke-width', 'x1', 'x2', 'y1', 'y2'],
      path: [
        'd',
        'fill',
        'fill-rule',
        'stroke',
        'stroke-linecap',
        'stroke-linejoin',
        'stroke-width',
      ],
      polygon: ['fill', 'points', 'stroke', 'stroke-width'],
      polyline: ['fill', 'points', 'stroke', 'stroke-width'],
      rect: ['fill', 'height', 'rx', 'ry', 'stroke', 'stroke-width', 'width', 'x', 'y'],
      svg: [
        'fill',
        'height',
        'preserveAspectRatio',
        'stroke',
        'stroke-width',
        'viewBox',
        'width',
        'xmlns',
      ],
    },
    allowedTags: ['circle', 'ellipse', 'g', 'line', 'path', 'polygon', 'polyline', 'rect', 'svg'],
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    enforceHtmlBoundary: true,
  });
  if (!/<svg(?:\s|>)/iu.test(sanitized)) throw new MediaProcessingError('unsafe_file_content');
  return sanitized;
}
