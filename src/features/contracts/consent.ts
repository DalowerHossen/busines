// src/features/contracts/consent.ts
// The words a signer agrees to before their signature counts.
//
// They live in their own module because both the signing page and the
// server action that records the signature need them, and because what was
// agreed has to be stored word for word rather than described.

/** The words the signer agrees to before the signature counts. */
export const ELECTRONIC_CONSENT_TEXT =
  'I agree to sign this document electronically and that my electronic signature is as binding as a handwritten one.';
