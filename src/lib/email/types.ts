// Server-side email contracts. Provider credentials are injected by trusted
// configuration resolution and never belong in a browser-facing message.

export type EmailProvider = 'resend_api' | 'resend_smtp';

export interface SendEmailRequest {
  readonly to: readonly string[];
  readonly subject: string;
  readonly html: string;
  readonly text: string;
  readonly from?: string;
  readonly replyTo?: string;
  readonly idempotencyKey: string;
}

export interface EmailProviderResult {
  readonly providerMessageId: string;
  readonly status: 'sent';
  readonly providerStatus: string | null;
  readonly provider: EmailProvider;
}

export interface EmailAdapter {
  readonly provider: EmailProvider;
  sendEmail(request: SendEmailRequest): Promise<EmailProviderResult>;
}

export interface EmailAdapterOptions {
  readonly timeoutMs?: number;
}

export interface EmailTemplateDefinition {
  readonly templateKey: string;
  readonly subjectTemplate: string;
  readonly bodyHtmlTemplate: string;
  readonly bodyTextTemplate: string;
  readonly variableNames: readonly string[];
}

export interface EmailTemplateVariables {
  readonly [name: string]: string | number | boolean;
}

export interface EmailFailureLog {
  readonly provider: EmailProvider;
  readonly retryable: boolean;
  readonly code: 'provider_request_failed' | 'template_invalid' | 'configuration_invalid';
}

export interface EmailFailureLogger {
  recordFailure(failure: EmailFailureLog): Promise<void>;
}

export interface PlatformMailResult {
  readonly sent: boolean;
  readonly providerMessageId: string | null;
  readonly failureCode: EmailFailureLog['code'] | null;
  readonly retryable: boolean;
}
