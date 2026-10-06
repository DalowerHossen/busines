import type { TemplateVariables, WhatsAppTemplateComponent } from './types';

const VARIABLE_PATTERN = /{{\s*([A-Za-z][A-Za-z0-9_.-]*)\s*}}/g;

function variableValue(name: string, variables: TemplateVariables): string {
  const value = variables[name];
  if (value === undefined || value === null) {
    throw new Error(`Message template variable "${name}" is missing.`);
  }
  return String(value);
}

export function renderMessageTemplate(
  template: string,
  variables: TemplateVariables,
  maxLength?: number
): string {
  const rendered = template.replace(VARIABLE_PATTERN, (_match, name: string) =>
    variableValue(name, variables)
  );
  if (rendered.includes('{{') || rendered.includes('}}')) {
    throw new Error('Message template contains an invalid or unresolved variable.');
  }
  const result = rendered.trim();
  if (result.length === 0) {
    throw new Error('Rendered message template is empty.');
  }
  if (maxLength !== undefined && result.length > maxLength) {
    throw new Error('Rendered message template exceeds the provider limit.');
  }
  return result;
}

export function renderWhatsAppTemplateComponents(
  components: readonly WhatsAppTemplateComponent[],
  variables: TemplateVariables
): readonly WhatsAppTemplateComponent[] {
  return components.map((component) => ({
    ...component,
    parameters: component.parameters.map((parameter) => ({
      ...parameter,
      text: renderMessageTemplate(parameter.text, variables),
    })),
  }));
}

export function templateVariableNames(template: string): readonly string[] {
  const names = new Set<string>();
  for (const match of template.matchAll(VARIABLE_PATTERN)) {
    const name = match[1];
    if (name) names.add(name);
  }
  return [...names];
}
