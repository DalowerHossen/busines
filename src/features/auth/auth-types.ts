import type { ActionResult } from '@/types/core';

export type OAuthProvider = 'google' | 'github';

export type AuthAction<TInput> = (input: TInput) => Promise<ActionResult<unknown>>;

export interface AuthFeedback {
  readonly type: 'success' | 'error';
  readonly message: string;
}
