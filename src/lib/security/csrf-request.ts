// src/lib/security/csrf-request.ts
// Route Handler helper for state-changing requests. Same-origin validation
// and an HMAC token are both required; safe methods do not need a token.
import 'server-only';

import { assertSameOrigin, verifyCsrfToken } from './csrf';
import { securityInvalidRequest } from './errors';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function assertCsrfProtectedRequest(input: {
  readonly method: string;
  readonly origin: string | undefined;
  readonly applicationOrigin: string;
  readonly csrfToken: string | undefined;
  readonly secret: string;
  readonly sessionId: string;
}): void {
  if (SAFE_METHODS.has(input.method.toUpperCase())) return;
  assertSameOrigin(input.origin, input.applicationOrigin);
  if (
    !input.csrfToken ||
    !verifyCsrfToken({
      token: input.csrfToken,
      secret: input.secret,
      sessionId: input.sessionId,
    })
  ) {
    throw securityInvalidRequest();
  }
}
