import { Alert } from '@/components/ui';
import type { AuthFeedback } from './auth-types';

export function AuthFeedbackMessage({
  feedback,
}: {
  readonly feedback: AuthFeedback | null;
}): React.ReactNode {
  if (!feedback) return null;
  return (
    <Alert variant={feedback.type === 'success' ? 'success' : 'danger'}>{feedback.message}</Alert>
  );
}
