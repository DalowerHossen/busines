import type { AccountRole } from '@/types/auth';
import { impersonationDenied, impersonationExpired, invalidCoreRequest } from './errors';
import type {
  ImpersonationAuditEvent,
  ImpersonationSession,
  ImpersonationAuditStore,
} from './types';

export interface ImpersonationSessionStore {
  create(input: {
    readonly session: ImpersonationSession;
    readonly audit: ImpersonationAuditEvent;
  }): Promise<ImpersonationSession>;
  end(input: {
    readonly session: ImpersonationSession;
    readonly audit: ImpersonationAuditEvent;
  }): Promise<ImpersonationSession>;
}

export async function startImpersonation(input: {
  readonly sessionId: string;
  readonly actorUserId: string;
  readonly actorRole: AccountRole;
  readonly targetUserId: string;
  readonly companyId: string;
  readonly reason: string;
  readonly consentAcceptedAt: string;
  readonly startedAt: string;
  readonly maxDurationSeconds: number;
  readonly store: ImpersonationSessionStore;
}): Promise<ImpersonationSession> {
  if (
    input.actorRole !== 'super_admin' ||
    !input.sessionId.trim() ||
    !input.actorUserId.trim() ||
    !input.targetUserId.trim() ||
    input.actorUserId === input.targetUserId ||
    !input.companyId.trim() ||
    !input.reason.trim() ||
    !isTimestamp(input.consentAcceptedAt) ||
    !isTimestamp(input.startedAt) ||
    !Number.isSafeInteger(input.maxDurationSeconds) ||
    input.maxDurationSeconds < 60 ||
    input.maxDurationSeconds > 3600
  ) {
    throw impersonationDenied();
  }
  const startedAt = new Date(input.startedAt);
  const expiresAt = new Date(startedAt.getTime() + input.maxDurationSeconds * 1000).toISOString();
  const session: ImpersonationSession = {
    sessionId: input.sessionId,
    actorUserId: input.actorUserId,
    targetUserId: input.targetUserId,
    companyId: input.companyId,
    reason: input.reason.trim(),
    readOnly: true,
    consentAcceptedAt: input.consentAcceptedAt,
    startedAt: startedAt.toISOString(),
    expiresAt,
    endedAt: null,
  };
  return input.store.create({ session, audit: auditFor(session, 'started', session.startedAt) });
}

export function assertImpersonationActive(input: {
  readonly session: ImpersonationSession;
  readonly now: string;
}): ImpersonationSession {
  if (!isTimestamp(input.now)) throw invalidCoreRequest();
  if (input.session.endedAt !== null) throw impersonationExpired();
  if (Date.parse(input.now) >= Date.parse(input.session.expiresAt)) throw impersonationExpired();
  return input.session;
}

export async function stopImpersonation(input: {
  readonly session: ImpersonationSession;
  readonly now: string;
  readonly store: ImpersonationSessionStore;
}): Promise<ImpersonationSession> {
  if (!isTimestamp(input.now)) throw invalidCoreRequest();
  if (input.session.endedAt !== null) throw impersonationExpired();
  const now = new Date(input.now).toISOString();
  const expired = Date.parse(now) >= Date.parse(input.session.expiresAt);
  const endedSession: ImpersonationSession = { ...input.session, endedAt: now };
  return input.store.end({
    session: endedSession,
    audit: auditFor(endedSession, expired ? 'expired' : 'stopped', now),
  });
}

export async function rejectImpersonatedMutation(input: {
  readonly session: ImpersonationSession;
  readonly now: string;
  readonly store: ImpersonationAuditStore;
}): Promise<never> {
  const session = assertImpersonationActive(input);
  await input.store.append(auditFor(session, 'blocked_mutation', input.now));
  throw impersonationDenied();
}

function auditFor(
  session: ImpersonationSession,
  action: ImpersonationAuditEvent['action'],
  occurredAt: string
): ImpersonationAuditEvent {
  return {
    sessionId: session.sessionId,
    actorUserId: session.actorUserId,
    targetUserId: session.targetUserId,
    companyId: session.companyId,
    action,
    occurredAt,
    metadata: { reason: session.reason, readOnly: 'true' },
  };
}

function isTimestamp(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}
