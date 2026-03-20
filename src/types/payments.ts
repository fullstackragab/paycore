// ─── Transaction states ───────────────────────────────────────────────────────

export type CardTransactionStatus =
  | "pending"
  | "authorized"
  | "captured"
  | "clearing"
  | "settled"
  | "declined"
  | "reversed"
  | "chargeback"
  | "refunded";

export type BankTransactionStatus =
  | "initiated"
  | "submitted"
  | "clearing"
  | "settled"
  | "returned"
  | "failed";

// ─── Card transaction ─────────────────────────────────────────────────────────

export type DeclineReason =
  | "insufficient_funds"
  | "card_expired"
  | "fraud_suspected"
  | "issuer_unavailable"
  | "do_not_honor"
  | "invalid_cvv"
  | "velocity_exceeded"
  | "restricted_card";

export type CardNetwork = "visa" | "mastercard" | "amex" | "discover";

export interface CardTransaction {
  id: string;
  createdAt: string; // ISO timestamp
  updatedAt: string;

  // Parties
  merchantName: string;
  merchantCategory: string; // MCC description
  merchantCountry: string;
  cardNetwork: CardNetwork;
  issuingBank: string;
  acquiringBank: string;

  // Amounts
  amount: number; // in cents
  currency: string;
  interchangeFee: number; // in cents
  schemeFee: number; // in cents
  processingFee: number; // in cents
  netSettlement: number; // in cents = amount - all fees

  // State
  status: CardTransactionStatus;
  declineReason?: DeclineReason;
  authCode?: string; // 6-char approval code
  rrn?: string; // Retrieval Reference Number

  // Flags
  isCardPresent: boolean;
  isInternational: boolean;
  is3DSecure: boolean;

  // Timeline (ISO timestamps, null if not yet reached)
  authorizedAt?: string;
  capturedAt?: string;
  clearedAt?: string;
  settledAt?: string;
}

// ─── Chargeback ───────────────────────────────────────────────────────────────

export type ChargebackStatus =
  | "received"
  | "under_review"
  | "evidence_submitted"
  | "won"
  | "lost";

export type ChargebackReason =
  | "fraud"
  | "not_received"
  | "duplicate"
  | "credit_not_processed"
  | "subscription_cancelled"
  | "unrecognized";

export interface Chargeback {
  id: string;
  transactionId: string;
  createdAt: string;
  status: ChargebackStatus;
  reason: ChargebackReason;
  amount: number; // in cents
  currency: string;
  deadlineAt: string; // respond-by date
  evidenceSubmittedAt?: string;
  resolvedAt?: string;
}

// ─── Settlement batch ─────────────────────────────────────────────────────────

export type SettlementStatus = "pending" | "processing" | "complete" | "failed";

export interface SettlementBatch {
  id: string;
  date: string; // YYYY-MM-DD
  status: SettlementStatus;
  transactionCount: number;
  grossAmount: number; // in cents
  totalFees: number; // in cents
  netAmount: number; // in cents
  processor: string;
  settledAt?: string;
}

// ─── Simulation config ────────────────────────────────────────────────────────

export interface SimulationConfig {
  transactionsPerMinute: number;
  declineRate: number; // 0–1
  chargebackRate: number; // 0–1
  internationalRate: number; // 0–1
  avgTransactionAmount: number; // in cents
}

// ─── Dashboard metrics ────────────────────────────────────────────────────────

export interface CardMetrics {
  totalVolume: number; // in cents
  totalCount: number;
  approvalRate: number; // 0–1
  avgTicket: number; // in cents
  chargebackRate: number; // 0–1
  totalFees: number; // in cents
  netRevenue: number; // in cents
  pendingSettlement: number; // in cents
}
