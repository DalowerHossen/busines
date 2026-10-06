// src/components/seo/json-ld.tsx
// Writes a structured data block into the page so search engines can read the
// facts about the business, the product and the questions answered on it.

export interface JsonLdProps {
  /** The record to serialise. */
  data: Record<string, unknown>;
}

/**
 * Renders one structured data block.
 *
 * @param props The record to serialise.
 * @returns The rendered script element.
 */
export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      // The payload is built by the application from its own constants, never
      // from user input, and is serialised with the safe characters escaped.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, '\\u003c'),
      }}
    />
  );
}
