export type WhatsAppTemplateCategory = 'authentication' | 'marketing' | 'utility';
export type WhatsAppTemplateStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'disabled';

export interface WhatsAppTemplateDefinition {
  readonly templateName: string;
  readonly languageCode: string;
  readonly category: WhatsAppTemplateCategory;
  readonly status: WhatsAppTemplateStatus;
  readonly providerTemplateId: string | null;
  readonly variableNames: readonly string[];
}

export function validateWhatsAppTemplateForSend(template: WhatsAppTemplateDefinition): void {
  if (!/^[a-z0-9_]+$/.test(template.templateName)) {
    throw new Error(
      'WhatsApp template names may contain only lowercase letters, numbers, and underscores.'
    );
  }
  if (!/^[a-z]{2}(?:_[A-Z]{2})?$/.test(template.languageCode)) {
    throw new Error('WhatsApp template language must use a configured locale code.');
  }
  if (template.status !== 'approved' || template.providerTemplateId === null) {
    throw new Error('Only provider-approved WhatsApp templates can be sent.');
  }
  if (new Set(template.variableNames).size !== template.variableNames.length) {
    throw new Error('WhatsApp template variable names must be unique.');
  }
}

export function missingWhatsAppTemplateVariables(
  template: WhatsAppTemplateDefinition,
  providedVariables: Readonly<Record<string, unknown>>
): readonly string[] {
  return template.variableNames.filter((name) => {
    const value = providedVariables[name];
    return value === undefined || value === null || String(value).trim() === '';
  });
}
