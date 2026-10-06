// src/types/database.ts
// The schema contract handed to the Supabase client. Row shapes are described
// as records of known JSON compatible values; feature modules narrow them into
// precise entity types through the mapping helpers in src/lib/records.ts.

import type { Json } from '@/types/json';
import type {
  AuditAction,
  AuthProvider,
  BillingInterval,
  CompanyStatus,
  DocumentType,
  EstimateStatus,
  GatewayMode,
  GatewayProvider,
  InvoiceStatus,
  KycStatus,
  MessageChannel,
  MessageStatus,
  PaymentMethodType,
  PaymentStatus,
  PermissionAction,
  RiskLevel,
  SubscriptionStatus,
  TaxMode,
  TwoFactorMethod,
  UserRole,
  UserStatus,
} from '@/types/enums';

/** A single value as PostgREST returns it over the wire. */
export type DatabaseValue = Json;

/** A row exactly as PostgREST returns it, before it is narrowed. */
export type DatabaseRow = { [column: string]: DatabaseValue | undefined };

/** Columns supplied when writing a row. */
export type DatabaseWrite = { [column: string]: DatabaseValue | undefined };

export interface DatabaseTable {
  Row: DatabaseRow;
  Insert: DatabaseWrite;
  Update: DatabaseWrite;
  Relationships: [];
}

export interface DatabaseView {
  Row: DatabaseRow;
  Relationships: [];
}

export interface DatabaseFunction {
  Args: DatabaseWrite;
  Returns: DatabaseValue;
}

export interface DatabaseEnums {
  audit_action: AuditAction;
  auth_provider: AuthProvider;
  billing_interval: BillingInterval;
  company_status: CompanyStatus;
  document_type: DocumentType;
  estimate_status: EstimateStatus;
  gateway_mode: GatewayMode;
  gateway_provider: GatewayProvider;
  invoice_status: InvoiceStatus;
  kyc_status: KycStatus;
  message_channel: MessageChannel;
  message_status: MessageStatus;
  payment_method_type: PaymentMethodType;
  payment_status: PaymentStatus;
  permission_action: PermissionAction;
  risk_level: RiskLevel;
  subscription_status: SubscriptionStatus;
  tax_mode: TaxMode;
  two_factor_method: TwoFactorMethod;
  user_role: UserRole;
  user_status: UserStatus;
}

export interface Database {
  public: {
    Tables: Record<string, DatabaseTable>;
    Views: Record<string, DatabaseView>;
    Functions: Record<string, DatabaseFunction>;
    Enums: DatabaseEnums;
    CompositeTypes: Record<string, never>;
  };
}

/** Name of the only schema the application reaches over the API. */
export const DATABASE_SCHEMA = 'public';
