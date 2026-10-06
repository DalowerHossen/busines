export { CommunicationProviderError } from './http';
export { sendClaimedMessage } from './delivery';
export type { DeliveryClaimStore, IdempotentDeliveryResult } from './delivery';
export { createCommunicationAdapter, requireCommunicationAdapter } from './registry';
export type { CommunicationAdapterConfig } from './registry';
export {
  WhatsAppCloudAdapter,
  parseWhatsAppWebhook,
  verifyWhatsAppChallenge,
  verifyWhatsAppSignature,
} from './whatsapp';
export { TwilioSmsAdapter, parseTwilioWebhook, verifyTwilioWebhook } from './twilio-sms';
export { TelegramBotAdapter, parseTelegramWebhook, verifyTelegramWebhook } from './telegram';
export { ViberBotAdapter, parseViberWebhook, verifyViberWebhook } from './viber';
export {
  dispatchAutomationEvent,
  renderAutomationMessage,
  selectAutomationRule,
} from './automation';
export {
  missingWhatsAppTemplateVariables,
  validateWhatsAppTemplateForSend,
} from './whatsapp-template';
export type {
  WhatsAppTemplateCategory,
  WhatsAppTemplateDefinition,
  WhatsAppTemplateStatus,
} from './whatsapp-template';
export {
  renderMessageTemplate,
  renderWhatsAppTemplateComponents,
  templateVariableNames,
} from './templates';
export { advanceMessageStatus, normalizeProviderStatus } from './status';
export { asRouteCandidates, sendWithFallback } from './router';
export {
  parseFormWebhook,
  parseProviderWebhook,
  verifyTelegramRequest,
  verifyTwilioRequest,
  verifyViberRequest,
  verifyWhatsAppRequest,
} from './webhooks';
export type * from './types';
