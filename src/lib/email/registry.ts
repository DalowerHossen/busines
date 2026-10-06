import 'server-only';

import { ResendApiAdapter } from './resend';
import type { ResendApiConfig } from './resend';
import { SmtpEmailAdapter } from './smtp';
import type { SmtpEmailConfig } from './smtp';
import type { EmailAdapter, EmailAdapterOptions } from './types';

export type EmailAdapterConfig =
  | { readonly provider: 'resend_api'; readonly config: ResendApiConfig }
  | { readonly provider: 'resend_smtp'; readonly config: SmtpEmailConfig };

export function createEmailAdapter(
  input: EmailAdapterConfig,
  options: EmailAdapterOptions = {}
): EmailAdapter {
  switch (input.provider) {
    case 'resend_api':
      return new ResendApiAdapter(input.config, options);
    case 'resend_smtp':
      return new SmtpEmailAdapter(input.config, options);
  }
}
