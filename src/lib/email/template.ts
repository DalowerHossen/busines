import type { EmailTemplateDefinition, EmailTemplateVariables } from './types';

const VARIABLE_PATTERN = /{{\s*([A-Za-z][A-Za-z0-9_.-]*)\s*}}/g;

function valueFor(name: string, variables: EmailTemplateVariables): string {
  const value = variables[name];
  if (value === undefined || value === null) {
    throw new Error(`Email template variable "${name}" is missing.`);
  }
  return String(value);
}

function replaceVariables(
  template: string,
  variables: EmailTemplateVariables,
  escapeValue: (value: string) => string
): string {
  const rendered = template.replace(VARIABLE_PATTERN, (_match, name: string) =>
    escapeValue(valueFor(name, variables))
  );
  if (rendered.includes('{{') || rendered.includes('}}')) {
    throw new Error('Email template contains an invalid or unresolved variable.');
  }
  return rendered;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function renderEmailTemplate(
  template: EmailTemplateDefinition,
  variables: EmailTemplateVariables
): { readonly subject: string; readonly html: string; readonly text: string } {
  const declared = new Set(template.variableNames);
  if (declared.size !== template.variableNames.length) {
    throw new Error('Email template variable names must be unique.');
  }
  const sources = [template.subjectTemplate, template.bodyHtmlTemplate, template.bodyTextTemplate];
  for (const source of sources) {
    for (const match of source.matchAll(VARIABLE_PATTERN)) {
      const name = match[1];
      if (name && !declared.has(name)) {
        throw new Error(`Email template variable "${name}" is not declared.`);
      }
    }
  }
  const subject = replaceVariables(template.subjectTemplate, variables, (value) => value).trim();
  const html = replaceVariables(template.bodyHtmlTemplate, variables, escapeHtml).trim();
  const text = replaceVariables(template.bodyTextTemplate, variables, (value) => value).trim();
  if (subject.length === 0 || html.length === 0 || text.length === 0) {
    throw new Error('Rendered email template contains an empty field.');
  }
  return { subject, html, text };
}
