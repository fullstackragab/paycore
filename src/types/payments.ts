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
  createdAt: string;                  // ISO timestamp
  updatedAt: string;

  // Parties
  merchantName: string;
  merchantCategory: string;           // MCC description
  merchantCountry: string;
  cardNetwork: CardNetwork;
  issuingBank: string;
  acquiringBank: string;

  // Amounts
  amount: number;                     // in cents
  currency: string;
  interchangeFee: number;             // in cents
  schemeFee: number;                  // in cents
  processingFee: number;              // in cents
  netSettlement: number;              // in cents = amount - all fees

  // State
  status: CardTransactionStatus;
  declineReason?: DeclineReason;
  authCode?: string;                  // 6-char approval code
  rrn?: string;                       // Retrieval Reference Number

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
  amount: number;                     // in cents
  currency: string;
  deadlineAt: string;                 // respond-by date
  evidenceSubmittedAt?: string;
  resolvedAt?: string;
}

// ─── Settlement batch ─────────────────────────────────────────────────────────

export type SettlementStatus = "pending" | "processing" | "complete" | "failed";

export interface SettlementBatch {
  id: string;
  date: string;                       // YYYY-MM-DD
  status: SettlementStatus;
  transactionCount: number;
  grossAmount: number;                // in cents
  totalFees: number;                  // in cents
  netAmount: number;                  // in cents
  processor: string;
  settledAt?: string;
}

// ─── Simulation config ────────────────────────────────────────────────────────

export interface SimulationConfig {
  transactionsPerMinute: number;
  declineRate: number;                // 0–1
  chargebackRate: number;             // 0–1
  internationalRate: number;          // 0–1
  avgTransactionAmount: number;       // in cents
}

// ─── Dashboard metrics ────────────────────────────────────────────────────────

export interface CardMetrics {
  totalVolume: number;                // in cents
  totalCount: number;
  approvalRate: number;               // 0–1
  avgTicket: number;                  // in cents
  chargebackRate: number;             // 0–1
  totalFees: number;                  // in cents
  netRevenue: number;                 // in cents
  pendingSettlement: number;          // in cents
}

// ─── Bank transfer types ──────────────────────────────────────────────────────

export type BankTransferType =
  | "ach_credit"
  | "ach_debit"
  | "wire"
  | "rtp"         // Real-Time Payments (The Clearing House)
  | "sepa_credit"
  | "sepa_debit";

export type BankTransferStatus =
  | "initiated"
  | "submitted"
  | "pending_settlement"
  | "settled"
  | "returned"
  | "failed"
  | "cancelled";

export type ACHReturnCode =
  | "R01" // Insufficient funds
  | "R02" // Account closed
  | "R03" // No account / unable to locate
  | "R04" // Invalid account number
  | "R05" // Unauthorized debit
  | "R07" // Authorization revoked
  | "R08" // Payment stopped
  | "R10" // Customer advises not authorized
  | "R16" // Account frozen
  | "R29" // Corporate customer advises not authorized
  | "R61" // Misrouted return;

export interface BankTransfer {
  id: string;
  createdAt: string;
  updatedAt: string;

  // Parties
  senderName: string;
  senderBank: string;
  senderAccountLast4: string;
  receiverName: string;
  receiverBank: string;
  receiverAccountLast4: string;

  // Transfer details
  type: BankTransferType;
  amount: number;           // in cents
  currency: string;
  description: string;
  companyEntryDescription?: string; // ACH batch header field

  // State
  status: BankTransferStatus;
  returnCode?: ACHReturnCode;
  returnDescription?: string;
  traceNumber?: string;     // ACH trace number

  // Timing
  effectiveDate: string;    // YYYY-MM-DD
  submittedAt?: string;
  settledAt?: string;
  returnedAt?: string;

  // Flags
  isSameDayACH: boolean;
  isInternational: boolean;
  prenoteRequired: boolean;
  prenoteVerifiedAt?: string;
}

export interface ACHBatch {
  id: string;
  createdAt: string;
  companyName: string;
  entryDescription: string
  effectiveDate: string;
  transferCount: number;
  totalDebit: number;       // in cents
  totalCredit: number;      // in cents
  status: "created" | "submitted" | "processing" | "settled" | "returned";
  returnCount: number;
  returnRate: number;       // 0-1
}

export interface BankMetrics {
  totalVolume: number;
  totalCount: number;
  settledCount: number;
  returnRate: number;
  avgSettlementHours: number;
  pendingVolume: number;
  returnedVolume: number;
  sameDayCount: number;
}

// ─── Cross-border types ───────────────────────────────────────────────────────

export type CrossBorderStatus =
  | "initiated"
  | "compliance_check"
  | "fx_converted"
  | "swift_sent"
  | "intermediary_processing"
  | "credited"
  | "failed"
  | "returned"
  | "sanctions_hold";

export type SWIFTMessageType =
  | "MT103"   // Single customer credit transfer
  | "MT202"   // General financial institution transfer
  | "MT199"   // Free format message
  | "MT900"   // Confirmation of debit
  | "MT910";  // Confirmation of credit

export type SanctionsResult = "clear" | "hold" | "blocked";
export type FXConversionType = "spot" | "forward" | "swap";

export interface CrossBorderPayment {
  id: string;
  createdAt: string;
  updatedAt: string;

  // Parties
  senderName: string;
  senderBank: string;
  senderBIC: string;
  senderCountry: string;
  receiverName: string;
  receiverBank: string;
  receiverBIC: string;
  receiverCountry: string;

  // Correspondent chain
  correspondentBank1?: string;
  correspondentBank2?: string;
  nostroAccount: string;

  // Amounts and FX
  sendAmount: number;         // in sender currency cents
  sendCurrency: string;
  receiveAmount: number;      // in receiver currency cents
  receiveCurrency: string;
  fxRate: number;             // e.g. 1.0823
  fxConversionType: FXConversionType;
  fxFee: number;              // in cents (sender currency)
  liftingFees: number;        // correspondent bank fees in cents
  ourFee: number;             // originator fee in cents

  // SWIFT
  swiftMessageType: SWIFTMessageType;
  uetr: string;               // Unique End-to-end Transaction Reference (GPI)
  endToEndRef: string;

  // Compliance
  sanctionsResult: SanctionsResult;
  sanctionsScreenedAt?: string;
  purposeCode: string;        // e.g. "SALA", "SUPP", "TRAD"
  remittanceInfo: string;

  // State
  status: CrossBorderStatus;
  failureReason?: string;

  // Timeline
  complianceCheckedAt?: string;
  fxConvertedAt?: string;
  swiftSentAt?: string;
  creditedAt?: string;
  estimatedArrival: string;   // ISO date
  valueDating: string;        // ISO date - when receiver's bank posts it
}

export interface FXRate {
  pair: string;               // e.g. "USD/EUR"
  baseCurrency: string;
  quoteCurrency: string;
  rate: number;
  bid: number;
  ask: number;
  spread: number;             // ask - bid
  updatedAt: string;
}

export interface CrossBorderMetrics {
  totalVolume: number;        // in USD cents
  totalCount: number;
  avgProcessingHours: number;
  sanctionsHoldCount: number;
  failedCount: number;
  totalFXFees: number;
  totalLiftingFees: number;
  corridors: { from: string; to: string; count: number; volume: number }[];
}
