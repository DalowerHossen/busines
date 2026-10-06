export type SecurityRouteClass = 'public' | 'auth' | 'sensitive' | 'api' | 'static';

export type SecurityHeaders = Readonly<Record<string, string>>;

export type SecurityFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

export interface SecurityRequestSnapshot {
  readonly pathname: string;
  readonly method: string;
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly ipAddress?: string;
  readonly accountIdentifier?: string;
}

export interface BotAssessment {
  readonly action: 'allow' | 'challenge' | 'block';
  readonly category: 'none' | 'ai-crawler' | 'seo-crawler' | 'automation' | 'suspicious';
  readonly score: number;
  readonly reasons: readonly string[];
}

export interface HoneypotPayload {
  readonly [field: string]: unknown;
}

export interface HoneypotAssessment {
  readonly tripped: boolean;
  readonly reason: 'filled' | 'too-fast' | 'invalid-timestamp' | null;
}

export interface RateLimitKeyInput {
  readonly pathname: string;
  readonly method: string;
  readonly ipAddress?: string;
  readonly accountIdentifier?: string;
  readonly userAgent?: string;
  readonly requestFingerprint?: string;
}

export interface RateLimitPolicy {
  readonly name: string;
  readonly limit: number;
  readonly windowSeconds: number;
  readonly failOpen: boolean;
}

export interface RateLimitConsumeInput {
  readonly bucketKey: string;
  readonly limit: number;
  readonly windowSeconds: number;
}

export interface RateLimitResult {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly resetAt: string;
}

export interface RateLimitStore {
  consume(input: RateLimitConsumeInput): Promise<RateLimitResult>;
}

export interface TurnstileValidationInput {
  readonly token: string;
  readonly remoteIp?: string;
  readonly idempotencyKey?: string;
}

export interface TurnstileValidationResult {
  readonly valid: boolean;
  readonly action: string | null;
  readonly hostname: string | null;
  readonly challengeTimestamp: string | null;
  readonly errorCodes: readonly string[];
}

export interface TurnstileValidator {
  validate(input: TurnstileValidationInput): Promise<TurnstileValidationResult>;
}

export type SecurityObservationType =
  | 'bot-blocked'
  | 'turnstile-challenge-failed'
  | 'turnstile-challenge-passed'
  | 'rate-limit-blocked'
  | 'rate-limit-unavailable'
  | 'honeypot-tripped';

export interface SecurityObservation {
  readonly type: SecurityObservationType;
  readonly pathname: string;
  readonly routeClass: SecurityRouteClass;
  readonly category: BotAssessment['category'];
  readonly occurredAt: string;
}

export interface SecurityObservationSink {
  record(observation: SecurityObservation): Promise<void>;
}

export interface RequestProtectionInput {
  readonly request: SecurityRequestSnapshot;
  readonly routeClass: SecurityRouteClass;
  readonly rateLimitStore?: RateLimitStore;
  readonly rateLimitPolicy?: RateLimitPolicy;
  readonly honeypot?: HoneypotPayload;
  readonly turnstileToken?: string;
  readonly turnstile?: TurnstileValidator;
  readonly expectedTurnstileAction?: string;
  readonly observationSink?: SecurityObservationSink;
}

export interface RequestProtectionDecision {
  readonly allowed: boolean;
  readonly statusCode: 200 | 400 | 403 | 429 | 503;
  readonly reason:
    | 'allowed'
    | 'bot'
    | 'honeypot'
    | 'turnstile'
    | 'turnstile-unavailable'
    | 'rate-limit'
    | 'rate-limit-unavailable';
  readonly bot: BotAssessment;
  readonly rateLimit: RateLimitResult | null;
}
