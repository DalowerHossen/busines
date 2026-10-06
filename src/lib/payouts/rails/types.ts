// src/lib/payouts/rails/types.ts
// What a payout rail has to be able to do.
//
// A rail is the network the money actually travels over once a payout has
// been approved. The payout module knows nothing about any particular
// network: it hands over an instruction and is told what happened.

import 'server-only';

import type { GatewayMode } from '@/types/enums';
import type { JsonObject } from '@/types/json';

export interface PayoutRailContext {
  /** Rail the credentials belong to. */
  rail: 'adyen' | 'nium';
  mode: GatewayMode;
  /** Credentials in clear text, decrypted for this call only. */
  credentials: Readonly<Record<string, string>>;
  /** Endpoints and identifiers saved beside the connection. */
  settings: JsonObject;
}

export interface PayoutInstruction {
  /** Identifier of the payout, used so a retry cannot pay twice. */
  payoutId: string;
  /** Amount to send, as a decimal string. */
  amount: string;
  /** Smallest unit of the currency, which is what the networks want. */
  amountMinor: number;
  /** Currency the money leaves in. */
  currency: string;
  /** Currency the beneficiary receives, when it differs. */
  destinationCurrency: string;
  /** Country the money is going to. */
  countryCode: string;
  /** Name on the receiving account. */
  beneficiaryName: string;
  /** Reference the provider already holds for the beneficiary, if any. */
  beneficiaryReference: string | null;
  /** Account number or wallet identifier at the far end. */
  accountNumber: string | null;
  /** Sort code, routing number or SWIFT code, when the corridor needs one. */
  routingCode: string | null;
  /** What the beneficiary sees on their statement. */
  narrative: string;
}

export interface PayoutDispatch {
  /** True when the network accepted the instruction. */
  isAccepted: boolean;
  /** Reference the network gave the transfer, kept for reconciliation. */
  providerReference: string | null;
  /** State the network reported, in its own words. */
  providerStatus: string | null;
  /** A sentence the platform team can act on. */
  message: string;
}

export interface PayoutRailAdapter {
  /** Name used in logs and in the connection list. */
  readonly key: 'adyen' | 'nium';

  /**
   * Checks the credentials without moving any money.
   *
   * @param context Credentials and configuration of the connection.
   * @returns Whether the network accepted the credentials.
   */
  verify(context: PayoutRailContext): Promise<PayoutDispatch>;

  /**
   * Sends one approved payout over the network.
   *
   * @param context Credentials and configuration of the connection.
   * @param instruction Who is paid, how much, and where.
   * @returns What the network said about the transfer.
   */
  send(context: PayoutRailContext, instruction: PayoutInstruction): Promise<PayoutDispatch>;
}
