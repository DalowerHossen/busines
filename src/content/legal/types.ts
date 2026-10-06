// src/content/legal/types.ts
// The shape of a legal document on the public website. Keeping the structure
// explicit lets one component render terms, privacy and cookies identically
// and lets the version and date be shown without being typed twice.

export interface LegalSection {
  /** Anchor used by the table of contents and by deep links. */
  id: string;
  heading: string;
  /** Body text, one entry per paragraph. */
  paragraphs: readonly string[];
  /** Optional list shown after the paragraphs. */
  bullets?: readonly string[];
}

export interface LegalDocument {
  title: string;
  /** One sentence summary shown under the title. */
  summary: string;
  /** Version of the document, referenced when consent is recorded. */
  version: string;
  /** Date the version takes effect, in ISO 8601 form. */
  effectiveDate: string;
  sections: readonly LegalSection[];
}
