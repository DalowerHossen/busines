import { renderMessageTemplate } from './templates';
import { sendWithFallback } from './router';
import type {
  CommunicationAutomationRule,
  RouteCandidate,
  RouteResult,
  TemplateVariables,
} from './types';

export interface CommunicationEvent {
  readonly name: string;
  readonly variables: TemplateVariables;
}

function matchesConditions(
  event: CommunicationEvent,
  conditions: CommunicationAutomationRule['conditions']
): boolean {
  return Object.entries(conditions).every(([key, expected]) => event.variables[key] === expected);
}

export function selectAutomationRule(
  event: CommunicationEvent,
  rules: readonly CommunicationAutomationRule[]
): CommunicationAutomationRule | null {
  return (
    rules
      .filter(
        (rule) =>
          rule.isEnabled &&
          rule.triggerEvent === event.name &&
          rule.messageBodyTemplate !== null &&
          matchesConditions(event, rule.conditions)
      )
      .sort(
        (left, right) => left.priority - right.priority || left.id.localeCompare(right.id)
      )[0] ?? null
  );
}

export function renderAutomationMessage(
  rule: CommunicationAutomationRule,
  variables: TemplateVariables
): string {
  if (rule.messageBodyTemplate === null) {
    throw new Error('The selected communication rule has no message template.');
  }
  return renderMessageTemplate(rule.messageBodyTemplate, variables);
}

export async function dispatchAutomationEvent(input: {
  readonly event: CommunicationEvent;
  readonly rules: readonly CommunicationAutomationRule[];
  readonly candidates: readonly RouteCandidate[];
  readonly idempotencyKey: string;
  readonly now?: Date;
  readonly statusCallbackUrl?: string;
}): Promise<{
  readonly rule: CommunicationAutomationRule | null;
  readonly result: RouteResult | null;
}> {
  const rule = selectAutomationRule(input.event, input.rules);
  if (!rule) {
    return { rule: null, result: null };
  }
  const body = renderAutomationMessage(rule, input.event.variables);
  const result = await sendWithFallback({
    body,
    idempotencyKey: input.idempotencyKey,
    primaryChannel: rule.channel,
    fallbackChannels: rule.fallbackChannels,
    candidates: input.candidates,
    now: input.now,
    statusCallbackUrl: input.statusCallbackUrl,
  });
  return { rule, result };
}
