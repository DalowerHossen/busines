'use client';

import { actionFailure, type ActionResult } from '@/types/core';
import type { AuthAction, AuthFeedback } from './auth-types';

export async function submitAuthAction<TInput>(
  action: AuthAction<TInput> | undefined,
  input: TInput
): Promise<{ readonly result: ActionResult<unknown>; readonly feedback: AuthFeedback }> {
  if (!action) {
    return {
      result: actionFailure('Authentication service is not available for this page.'),
      feedback: {
        type: 'error',
        message: 'Authentication service is not available for this page.',
      },
    };
  }
  try {
    const result = await action(input);
    return {
      result,
      feedback: result.success
        ? { type: 'success', message: 'Request completed successfully.' }
        : { type: 'error', message: result.error },
    };
  } catch {
    return {
      result: actionFailure('We could not complete this request.'),
      feedback: { type: 'error', message: 'We could not complete this request.' },
    };
  }
}
