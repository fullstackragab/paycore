import {
  CardTransaction,
  CardTransactionStatus,
  CardNetwork,
  DeclineReason,
  Chargeback,
  ChargebackReason,
  SettlementBatch,
  CardMetrics,
  SimulationConfig,
} from "@/types/payments";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function cents(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3_600_000).toISOString();
}

function minutesAgo(m: number): string {
  return new Date(Date.now() - m * 60_000).toISOString();
}

function addMinutes(iso: string, m: number): string {
  return new Date(new Date(iso).getTime() + m * 60_000).toISOString();
}

// ─── Static data ──────────────────────────────────────────────────────────────

const MERCHANTS = [
  { name: "Amazon", category: "Online Retail", country: "US" },
  { name: "Uber", category: "Ride-sharing", country: "US" },
  { name: "Netflix", category: "Subscription", country: "US" },
  { name: "Apple Store", category: "Electronics", country: "US" },
  { name: "Carrefour", category: "Grocery", country: "EG" },
  { name: "Noon", category: "Online Retail", country: "AE" },
  { name: "Bolt", category: "Ride-sharing", country: "EG" },
  { name: "Booking.com", category: "Travel", country: "NL" },
  { name: "Starbucks", category: "Food and Beverage", country: "US" },
  { name: "Talabat", category: "Food Delivery", country: "AE" },
  { name: "Spotify", category: "Subscription", country: "SE" },
  { name: "IKEA", category: "Home Furnishings", country: "SE" },
  { name: "Etsy", category: "Online Retail", country: "US" },
  { name: "Namshi", category: "Fashion", country: "AE" },
  { name: "Emirates NBD", category: "Financial Services", country: "AE" },
];

const ISSUING_BANKS = [
  "Chase",
  "Bank of America",
  "CIB Egypt",
  "ADCB",
  "Barclays",
  "HSBC",
  "Revolut",
  "QNB",
  "NBE Egypt",
];

const ACQUIRING_BANKS = [
  "Stripe",
  "Adyen",
  "Checkout.com",
  "Fawry",
  "Network International",
  "Worldpay",
];

const NETWORKS: CardNetwork[] = ["visa", "mastercard", "amex", "discover"];

const DECLINE_REASONS: DeclineReason[] = [
  "insufficient_funds",
  "card_expired",
  "fraud_suspected",
  "issuer_unavailable",
  "do_not_honor",
  "invalid_cvv",
  "velocity_exceeded",
  "restricted_card",
];

const CHARGEBACK_REASONS: ChargebackReason[] = [
  "fraud",
  "not_received",
  "duplicate",
  "credit_not_processed",
  "subscription_cancelled",
  "unrecognized",
];

// ─── Interchange rates by network (basis points) ──────────────────────────────

const INTERCHANGE_BPS: Record<CardNetwork, number> = {
  visa: 180,
  mastercard: 175,
  amex: 250,
  discover: 160,
};

const SCHEME_FEE_CENTS = 4; // flat per transaction
const PROCESSING_FEE_BPS = 30; // 0.30%

// ─── Single transaction factory ───────────────────────────────────────────────

export function generateTransaction(
  config: SimulationConfig,
  createdAt?: string,
): CardTransaction {
  const merchant = pick(MERCHANTS);
  const network = pick(NETWORKS);
  const isDecline = Math.random() < config.declineRate;
  const isIntl =
    merchant.country !== "US" || Math.random() < config.internationalRate;

  const amount = cents(
    config.avgTransactionAmount * 0.1,
    config.avgTransactionAmount * 3,
  );

  const interchangeFee = Math.round(
    (amount * INTERCHANGE_BPS[network]) / 10_000,
  );
  const processingFee = Math.round((amount * PROCESSING_FEE_BPS) / 10_000);
  const schemeFee = SCHEME_FEE_CENTS;
  const netSettlement = amount - interchangeFee - processingFee - schemeFee;

  const created = createdAt ?? minutesAgo(Math.floor(Math.random() * 120));

  let status: CardTransactionStatus;
  let declineReason: DeclineReason | undefined;
  let authCode: string | undefined;
  let authorizedAt: string | undefined;
  let capturedAt: string | undefined;
  let clearedAt: string | undefined;
  let settledAt: string | undefined;

  if (isDecline) {
    status = "declined";
    declineReason = pick(DECLINE_REASONS);
  } else {
    // Randomly place transaction somewhere along the lifecycle
    const stage = Math.random();
    authCode = uid().slice(0, 6);
    authorizedAt = addMinutes(created, 0.05);

    if (stage < 0.05) {
      status = "authorized";
    } else if (stage < 0.1) {
      status = "captured";
      capturedAt = addMinutes(created, 1);
    } else if (stage < 0.2) {
      status = "clearing";
      capturedAt = addMinutes(created, 1);
      clearedAt = addMinutes(created, 60);
    } else if (stage < 0.92) {
      status = "settled";
      capturedAt = addMinutes(created, 1);
      clearedAt = addMinutes(created, 60);
      settledAt = addMinutes(created, 1440); // ~24h
    } else if (stage < 0.96) {
      status = "refunded";
      capturedAt = addMinutes(created, 1);
      clearedAt = addMinutes(created, 60);
      settledAt = addMinutes(created, 1440);
    } else {
      status = "chargeback";
      capturedAt = addMinutes(created, 1);
      clearedAt = addMinutes(created, 60);
      settledAt = addMinutes(created, 1440);
    }
  }

  return {
    id: `TXN-${uid()}`,
    createdAt: created,
    updatedAt: new Date().toISOString(),
    merchantName: merchant.name,
    merchantCategory: merchant.category,
    merchantCountry: merchant.country,
    cardNetwork: network,
    issuingBank: pick(ISSUING_BANKS),
    acquiringBank: pick(ACQUIRING_BANKS),
    amount,
    currency: "USD",
    interchangeFee,
    schemeFee,
    processingFee,
    netSettlement,
    status,
    declineReason,
    authCode,
    rrn: `RRN${uid()}`,
    isCardPresent: Math.random() > 0.7,
    isInternational: isIntl,
    is3DSecure: !isDecline && Math.random() > 0.4,
    authorizedAt,
    capturedAt,
    clearedAt,
    settledAt,
  };
}

// ─── Batch generator ──────────────────────────────────────────────────────────

export function generateTransactions(
  count: number,
  config: SimulationConfig,
): CardTransaction[] {
  return Array.from({ length: count }, (_, i) =>
    generateTransaction(config, hoursAgo((count - i) * 0.15)),
  );
}

// ─── Chargeback generator ─────────────────────────────────────────────────────

export function generateChargebacks(
  transactions: CardTransaction[],
): Chargeback[] {
  return transactions
    .filter((t) => t.status === "chargeback" || t.status === "settled")
    .slice(0, 8)
    .map((t) => ({
      id: `CB-${uid()}`,
      transactionId: t.id,
      createdAt: t.settledAt ?? t.createdAt,
      status: pick([
        "received",
        "under_review",
        "evidence_submitted",
        "won",
        "lost",
      ] as const),
      reason: pick(CHARGEBACK_REASONS),
      amount: t.amount,
      currency: t.currency,
      deadlineAt: addMinutes(t.settledAt ?? t.createdAt, 30 * 24 * 60),
      evidenceSubmittedAt:
        Math.random() > 0.5
          ? addMinutes(t.settledAt ?? t.createdAt, 5 * 24 * 60)
          : undefined,
      resolvedAt:
        Math.random() > 0.6
          ? addMinutes(t.settledAt ?? t.createdAt, 20 * 24 * 60)
          : undefined,
    }));
}

// ─── Settlement batch generator ───────────────────────────────────────────────

export function generateSettlementBatches(): SettlementBatch[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(Date.now() - i * 86_400_000);
    const count = cents(800, 2400);
    const gross = count * cents(2000, 8000);
    const fees = Math.round(gross * 0.022);
    const net = gross - fees;
    const status = i === 0 ? "processing" : "complete";
    return {
      id: `BATCH-${uid()}`,
      date: date.toISOString().slice(0, 10),
      status,
      transactionCount: count,
      grossAmount: gross,
      totalFees: fees,
      netAmount: net,
      processor: pick(ACQUIRING_BANKS),
      settledAt:
        status === "complete"
          ? addMinutes(date.toISOString(), 1440)
          : undefined,
    };
  });
}

// ─── Metrics calculator ───────────────────────────────────────────────────────

export function calcMetrics(transactions: CardTransaction[]): CardMetrics {
  const approved = transactions.filter((t) => t.status !== "declined");
  const totalVolume = approved.reduce((s, t) => s + t.amount, 0);
  const totalFees = approved.reduce(
    (s, t) => s + t.interchangeFee + t.schemeFee + t.processingFee,
    0,
  );
  const chargebacks = transactions.filter(
    (t) => t.status === "chargeback",
  ).length;
  const pendingSettlement = approved
    .filter((t) => ["authorized", "captured", "clearing"].includes(t.status))
    .reduce((s, t) => s + t.amount, 0);

  return {
    totalVolume,
    totalCount: transactions.length,
    approvalRate: approved.length / (transactions.length || 1),
    avgTicket: totalVolume / (approved.length || 1),
    chargebackRate: chargebacks / (approved.length || 1),
    totalFees,
    netRevenue: totalVolume - totalFees,
    pendingSettlement,
  };
}

// ─── Default simulation config ────────────────────────────────────────────────

export const DEFAULT_CONFIG: SimulationConfig = {
  transactionsPerMinute: 4,
  declineRate: 0.12,
  chargebackRate: 0.008,
  internationalRate: 0.25,
  avgTransactionAmount: 8500, // $85.00
};
