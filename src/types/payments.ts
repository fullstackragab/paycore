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

// ─── Risk & Fraud types ───────────────────────────────────────────────────────

export type FraudType =
  | "card_not_present"
  | "account_takeover"
  | "friendly_fraud"
  | "identity_theft"
  | "merchant_fraud"
  | "mule_account"
  | "social_engineering"
  | "velocity_abuse";

export type RiskDecision = "approve" | "decline" | "review" | "challenge_3ds";

export type ReviewStatus = "pending" | "approved" | "declined" | "escalated";

export type RuleAction = "approve" | "decline" | "flag" | "challenge";

export interface RiskEvent {
  id: string;
  createdAt: string;
  transactionId: string;

  // Scores
  riskScore: number;          // 0–1000, higher = riskier
  fraudProbability: number;   // 0–1
  deviceScore: number;        // 0–100, higher = more trusted
  velocityScore: number;      // 0–100, higher = more suspicious

  // Signals
  isNewDevice: boolean;
  isVPNOrProxy: boolean;
  isHighRiskCountry: boolean;
  isUnusualHour: boolean;
  isUnusualAmount: boolean;
  velocityBreached: boolean;
  deviceFingerprint: string;
  ipCountry: string;
  cardCountry: string;
  countryMismatch: boolean;

  // Decision
  decision: RiskDecision;
  rulesTriggered: string[];
  reviewStatus?: ReviewStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;

  // Outcome
  isFraudConfirmed?: boolean;
  fraudType?: FraudType;
  amount: number;
  merchantName: string;
}

export interface FraudCase {
  id: string;
  createdAt: string;
  transactionId: string;
  fraudType: FraudType;
  amount: number;
  currency: string;
  merchantName: string;
  status: "open" | "investigating" | "confirmed" | "dismissed";
  lossAmount: number;         // actual loss after recovery
  recoveredAmount: number;
  notes?: string;
}

export interface RiskRule {
  id: string;
  name: string;
  description: string;
  action: RuleAction;
  isActive: boolean;
  triggeredCount: number;
  falsePositiveRate: number;  // 0–1
  category: "velocity" | "device" | "geo" | "amount" | "behavioral";
}

export interface RiskMetrics {
  totalEventsReviewed: number;
  approvalRate: number;
  declineRate: number;
  reviewRate: number;
  fraudRate: number;
  falsePositiveRate: number;
  fraudLoss: number;          // in cents
  recoveredAmount: number;    // in cents
  avgRiskScore: number;
}

// ─── Reconciliation types ─────────────────────────────────────────────────────

export type ReconStatus =
  | "matched"
  | "unmatched"
  | "mismatched_amount"
  | "duplicate"
  | "timing_difference"
  | "missing_in_bank"
  | "missing_in_ledger";

export type ReconSource = "internal_ledger" | "processor_file" | "bank_statement";

export interface ReconRecord {
  id: string;
  date: string;
  transactionId: string;
  merchantName: string;
  ledgerAmount: number;       // what our system says
  processorAmount: number;    // what processor settlement file says
  bankAmount: number;         // what bank statement says
  currency: string;
  status: ReconStatus;
  discrepancy: number;        // difference in cents
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNote?: string;
  processorRef: string;
  bankRef: string;
}

export interface ReconBatch {
  id: string;
  date: string;
  totalRecords: number;
  matchedCount: number;
  unmatchedCount: number;
  mismatchedCount: number;
  duplicateCount: number;
  timingCount: number;
  totalDiscrepancy: number;   // in cents
  status: "running" | "complete" | "needs_review";
  completedAt?: string;
}

export interface LedgerEntry {
  id: string;
  createdAt: string;
  transactionId: string;
  entryType: "debit" | "credit";
  amount: number;
  currency: string;
  accountName: string;
  description: string;
  balance: number;            // running balance after this entry
  isReconciled: boolean;
  reconId?: string;
}

export interface ReconMetrics {
  totalRecords: number;
  matchRate: number;
  totalDiscrepancy: number;
  openBreaks: number;
  avgResolutionHours: number;
  duplicatesFound: number;
  timingDifferences: number;
}

// ─── Compliance & Treasury types ──────────────────────────────────────────────

export type KYCStatus = "pending" | "approved" | "rejected" | "needs_review" | "expired";
export type KYBStatus = "pending" | "approved" | "rejected" | "needs_review" | "suspended";
export type AMLAlertStatus = "open" | "investigating" | "escalated" | "cleared" | "reported";
export type AMLAlertType =
  | "structuring"
  | "rapid_movement"
  | "high_risk_corridor"
  | "round_amount_pattern"
  | "dormant_account_activity"
  | "unusual_velocity"
  | "pep_transaction"
  | "sanctions_proximity";

export interface KYCRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  customerId: string;
  customerName: string;
  customerType: "individual" | "business";
  status: KYCStatus;
  riskTier: "low" | "medium" | "high";
  country: string;
  documentsSubmitted: string[];
  reviewedBy?: string;
  reviewedAt?: string;
  expiresAt: string;
  notes?: string;
}

export interface AMLAlert {
  id: string;
  createdAt: string;
  customerId: string;
  customerName: string;
  alertType: AMLAlertType;
  status: AMLAlertStatus;
  riskScore: number;        // 0–100
  transactionCount: number;
  totalAmount: number;
  currency: string;
  description: string;
  assignedTo?: string;
  resolvedAt?: string;
  sarFiled: boolean;        // Suspicious Activity Report
}

export interface ReserveAccount {
  id: string;
  merchantId: string;
  merchantName: string;
  reserveType: "rolling" | "fixed" | "capped";
  reserveRate: number;      // 0–1, e.g. 0.05 = 5%
  currentBalance: number;   // in cents
  requiredBalance: number;  // in cents
  currency: string;
  releaseSchedule: string;
  nextReleaseDate: string;
  nextReleaseAmount: number;
}

export interface TreasuryPosition {
  currency: string;
  nostroBalance: number;     // funds held at correspondent
  prefundedAmount: number;   // pre-funded for outgoing
  reservedAmount: number;    // held as reserve
  availableAmount: number;   // free to use
  pendingInbound: number;
  pendingOutbound: number;
  lastUpdated: string;
}

export interface ComplianceMetrics {
  totalKYCRecords: number;
  approvedKYC: number;
  pendingKYC: number;
  rejectedKYC: number;
  openAMLAlerts: number;
  sarsFiled: number;
  highRiskCustomers: number;
  totalReserveHeld: number;
}
