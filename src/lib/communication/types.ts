// Provider-neutral communication contracts. Credentials, webhook secrets, and
// raw recipient addresses are accepted only by trusted server-side adapters.

export type CommunicationChannel = 'whatsapp' | 'sms' | 'telegram' | 'viber' | 'email';
export type CommunicationMessageStatus =
  | 'queued'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'cancelled';

export interface SendTextMessageRequest {
  readonly recipient: string;
  readonly body: string;
  readonly idempotencyKey: string;
  readonly statusCallbackUrl?: string;
}

export interface ProviderMessageResult {
  readonly providerMessageId: string;
  readonly status: CommunicationMessageStatus;
  readonly providerStatus: string | null;
  readonly raw: Readonly<Record<string, unknown>>;
}

export interface CommunicationAdapter {
  readonly channel: CommunicationChannel;
  sendText(request: SendTextMessageRequest): Promise<ProviderMessageResult>;
}

export interface CommunicationAdapterOptions {
  readonly timeoutMs?: number;
}

export interface WhatsAppTemplateParameter {
  readonly type: 'text';
  readonly text: string;
}

export interface WhatsAppTemplateComponent {
  readonly type: 'header' | 'body' | 'button';
  readonly subType?: 'quick_reply' | 'url';
  readonly index?: string;
  readonly parameters: readonly WhatsAppTemplateParameter[];
}

export interface SendWhatsAppTemplateRequest extends SendTextMessageRequest {
  readonly templateName: string;
  readonly languageCode: string;
  readonly components?: readonly WhatsAppTemplateComponent[];
}

export interface WhatsAppAdapter extends CommunicationAdapter {
  sendTemplate(request: SendWhatsAppTemplateRequest): Promise<ProviderMessageResult>;
}

export interface ProviderWebhookRequest {
  readonly rawBody: string;
  readonly headers: Readonly<Record<string, string | undefined>>;
}

export interface InboundCommunicationEvent {
  readonly channel: CommunicationChannel;
  readonly providerEventId: string;
  readonly eventType: 'message' | 'delivered' | 'read' | 'failed' | 'unknown';
  readonly providerMessageId: string | null;
  readonly senderAddress: string | null;
  readonly recipientAddress: string | null;
  readonly text: string | null;
  readonly occurredAt: string | null;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface ClientChannelPreference {
  readonly channel: CommunicationChannel;
  readonly address: string;
  readonly isEnabled: boolean;
  readonly isPrimary: boolean;
  readonly optedInAt: string | null;
  readonly optedOutAt: string | null;
}

export interface RouteCandidate extends ClientChannelPreference {
  readonly adapter: CommunicationAdapter | null;
}

export interface RouteAttempt {
  readonly channel: CommunicationChannel;
  readonly recipient: string;
  readonly status: 'sent' | 'failed' | 'skipped';
  readonly reason: string | null;
  readonly providerMessageId: string | null;
}

export interface RouteResult {
  readonly delivered: boolean;
  readonly selectedChannel: CommunicationChannel | null;
  readonly attempts: readonly RouteAttempt[];
  readonly providerResult: ProviderMessageResult | null;
}

export type TemplateVariables = Readonly<Record<string, string | number | boolean>>;

export interface CommunicationAutomationRule {
  readonly id: string;
  readonly triggerEvent: string;
  readonly channel: CommunicationChannel;
  readonly fallbackChannels: readonly CommunicationChannel[];
  readonly messageBodyTemplate: string | null;
  readonly conditions: Readonly<Record<string, string | number | boolean>>;
  readonly priority: number;
  readonly isEnabled: boolean;
}
