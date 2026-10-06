// src/lib/html/sanitise-contract-html.ts
// Making tenant written wording safe to render.
//
// The wording of an agreement is typed by a person and then shown to a
// client who holds no account, so it is treated as untrusted. Only a small
// set of formatting tags survive, and every attribute is dropped, which
// removes event handlers, styles and links to anywhere else in one move.

/** The tags an agreement is allowed to use. */
const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'hr',
  'h1',
  'h2',
  'h3',
  'h4',
  'strong',
  'b',
  'em',
  'i',
  'u',
  'ul',
  'ol',
  'li',
  'blockquote',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'div',
  'span',
]);

/**
 * Strips everything from wording that a browser could act on.
 *
 * @param html The wording as it was typed.
 * @returns The same wording with only safe formatting left.
 */
export function sanitiseContractHtml(html: string): string {
  const withoutBlocks = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|iframe|object|embed|form)[\s\S]*?<\/\1>/gi, '')
    .replace(/<(script|style|iframe|object|embed|form)[^>]*>/gi, '');

  return withoutBlocks.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (match, rawName: string) => {
    const name = rawName.toLowerCase();

    if (!ALLOWED_TAGS.has(name)) {
      return '';
    }

    return match.startsWith('</') ? `</${name}>` : `<${name}>`;
  });
}
