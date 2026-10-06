export { EmailProviderError } from './http';
export { asCommunicationEmailAdapter } from './communication-adapter';
export {
  filterSuppressedRecipients,
  hashEmailAddress,
  normalizeEmailAddress,
  recordSuppressionFromResendEvent,
} from './deliverability';
export { processClaimedEmail } from './queue';
export { createEmailAdapter } from './registry';
export type { EmailAdapterConfig } from './registry';
export { ResendApiAdapter } from './resend';
export { SmtpEmailAdapter } from './smtp';
export { renderEmailTemplate } from './template';
export { emailEventToMessageStatus } from './status';
export { parseVerifiedResendWebhook, verifyResendWebhook } from './webhooks';
export { sendPlatformMail, sendTemplatedPlatformMail } from './platform-mail';
export type { EmailSuppressionReason, EmailSuppressionStore } from './deliverability';
export type { EmailDeliveryClaimStore, QueuedEmailResult } from './queue';
export type {
  EmailDeliveryEventStatus,
  ResendEmailEventType,
  VerifiedEmailWebhookEvent,
} from './webhooks';
export type {
  EmailAdapter,
  EmailAdapterOptions,
  EmailFailureLog,
  EmailFailureLogger,
  EmailProvider,
  EmailProviderResult,
  EmailTemplateDefinition,
  EmailTemplateVariables,
  PlatformMailResult,
  SendEmailRequest,
} from './types';
export type { ResendApiConfig } from './resend';
export type { SmtpEmailConfig } from './smtp';
