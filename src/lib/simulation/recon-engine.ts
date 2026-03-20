import {
  ReconRecord, ReconStatus, ReconBatch,
  LedgerEntry, ReconMetrics,
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

function daysAgo(d: number): string {
  return new Date(Date.now() - d * 86_400_000).toISOString().slice(0, 10);
}

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3_600_000).toISOString();
}

function addHours(iso: string, h: number): string {
  return new Date(new Date(iso).getTime() + h * 3_600_000).toISOString();
}

// ─── Static data ──────────────────────────────────────────────────────────────

const MERCHANTS = [
  "Amazon", "Uber", "Netflix", "Apple Store", "Noon",
  "Booking.com", "Starbucks", "Talabat", "Spotify", "Steam",
  "Carrefour", "IKEA", "Namshi", "Deliveroo", "Etsy",
];

const PROCESSORS = ["Stripe", "Adyen", "Checkout.com", "Worldpay", "Fawry"];
const BANKS      = ["Chase", "Bank of America", "Barclays", "HSBC", "CIB Egypt"];

const RESOLUTION_NOTES = [
  "Timing difference — transaction settled in next day's batch",
  "Duplicate entry removed — processor sent file twice",
  "Fee deduction applied correctly — updated internal ledger",
  "Bank rounding difference — $0.01 accepted within tolerance",
  "Processor correction received — original file had wrong amount",
  "Manual journal entry created to match bank statement",
  "FX conversion difference — rate applied at different times",
];

const RESOLVERS = ["Fatima A.", "Carlos M.", "Yuki T.", "Sarah K.", "Omar H."];

const ACCOUNT_NAMES = [
  "Merchant settlement account",
  "Interchange fee payable",
  "Scheme fee payable",
  "Processing fee payable",
  "Reserve account",
  "Chargeback reserve",
  "Operating account",
];

// ─── Single recon record factory ──────────────────────────────────────────────

export function generateReconRecord(date: string): ReconRecord {
  const baseAmount    = cents(500, 500_000);
  const statusRoll    = Math.random();

  let status: ReconStatus;
  let ledgerAmount    = baseAmount;
  let processorAmount = baseAmount;
  let bankAmount      = baseAmount;
  let discrepancy     = 0;
  let resolvedAt: string | undefined;
  let resolvedBy: string | undefined;
  let resolutionNote: string | undefined;

  if (statusRoll < 0.78) {
    // Happy path — all match
    status = "matched";
  } else if (statusRoll < 0.83) {
    // Mismatched amount
    status          = "mismatched_amount";
    const delta     = cents(1, 500);
    processorAmount = baseAmount + delta;
    discrepancy     = delta;
    if (Math.random() > 0.4) {
      resolvedAt     = addHours(`${date}T12:00:00Z`, Math.random() * 24);
      resolvedBy     = pick(RESOLVERS);
      resolutionNote = pick(RESOLUTION_NOTES);
    }
  } else if (statusRoll < 0.87) {
    // Missing in bank
    status      = "missing_in_bank";
    bankAmount  = 0;
    discrepancy = baseAmount;
  } else if (statusRoll < 0.90) {
    // Missing in ledger
    status        = "missing_in_ledger";
    ledgerAmount  = 0;
    discrepancy   = baseAmount;
  } else if (statusRoll < 0.93) {
    // Timing difference
    status      = "timing_difference";
    bankAmount  = 0;
    discrepancy = baseAmount;
    resolvedAt  = addHours(`${date}T12:00:00Z`, Math.random() * 48 + 24);
    resolvedBy  = pick(RESOLVERS);
    resolutionNote = "Timing difference — transaction settled in next day's batch";
  } else if (statusRoll < 0.96) {
    // Duplicate
    status          = "duplicate";
    processorAmount = baseAmount * 2;
    discrepancy     = baseAmount;
    resolvedAt      = addHours(`${date}T12:00:00Z`, Math.random() * 8);
    resolvedBy      = pick(RESOLVERS);
    resolutionNote  = "Duplicate entry removed — processor sent file twice";
  } else {
    // Unmatched
    status      = "unmatched";
    discrepancy = baseAmount;
  }

  return {
    id:             `REC-${uid()}`,
    date,
    transactionId:  `TXN-${uid()}`,
    merchantName:   pick(MERCHANTS),
    ledgerAmount,
    processorAmount,
    bankAmount,
    currency:       "USD",
    status,
    discrepancy,
    resolvedAt,
    resolvedBy,
    resolutionNote,
    processorRef:   `${pick(PROCESSORS)}-${uid()}`,
    bankRef:        `${pick(BANKS)}-${uid()}`,
  };
}

// ─── Batch generators ─────────────────────────────────────────────────────────

export function generateReconRecords(count: number): ReconRecord[] {
  const today = daysAgo(0);
  return Array.from({ length: count }, () =>
    generateReconRecord(today)
  );
}

export function generateReconBatches(): ReconBatch[] {
  return Array.from({ length: 7 }, (_, i) => {
    const total     = cents(800, 2500);
    const matched   = Math.floor(total * (0.75 + Math.random() * 0.12));
    const mismatched= Math.floor(total * (0.02 + Math.random() * 0.04));
    const duplicate = Math.floor(total * (0.005 + Math.random() * 0.01));
    const timing    = Math.floor(total * (0.01 + Math.random() * 0.02));
    const unmatched = total - matched - mismatched - duplicate - timing;
    const discrepancy = mismatched * cents(1, 500) + unmatched * cents(500, 10000);

    return {
      id:               `BATCH-${uid()}`,
      date:             daysAgo(i),
      totalRecords:     total,
      matchedCount:     matched,
      unmatchedCount:   Math.max(0, unmatched),
      mismatchedCount:  mismatched,
      duplicateCount:   duplicate,
      timingCount:      timing,
      totalDiscrepancy: discrepancy,
      status:           i === 0 ? "running" : i <= 2 && unmatched > 5 ? "needs_review" : "complete",
      completedAt:      i === 0 ? undefined : addHours(daysAgo(i), 6),
    };
  });
}

export function generateLedgerEntries(): LedgerEntry[] {
  let balance = 10_000_000_00; // $10M starting balance
  return Array.from({ length: 40 }, (_, i) => {
    const isCredit  = Math.random() > 0.4;
    const amount    = cents(5_000, 200_000_00);
    balance         = isCredit ? balance + amount : balance - amount;
    const createdAt = hoursAgo(i * 2);

    return {
      id:            `LED-${uid()}`,
      createdAt,
      transactionId: `TXN-${uid()}`,
      entryType:     isCredit ? "credit" : "debit",
      amount,
      currency:      "USD",
      accountName:   pick(ACCOUNT_NAMES),
      description:   isCredit
        ? pick(["Settlement received", "Merchant refund reversal", "Chargeback recovery", "Fee reversal"])
        : pick(["Merchant payout", "Interchange fee", "Scheme fee", "Chargeback debit", "Processing fee"]),
      balance:       Math.max(0, balance),
      isReconciled:  Math.random() > 0.15,
      reconId:       Math.random() > 0.15 ? `REC-${uid()}` : undefined,
    };
  });
}

// ─── Metrics ──────────────────────────────────────────────────────────────────

export function calcReconMetrics(records: ReconRecord[]): ReconMetrics {
  const matched    = records.filter(r => r.status === "matched");
  const open       = records.filter(r => !r.resolvedAt && r.status !== "matched");
  const resolved   = records.filter(r => r.resolvedAt);

  const avgResHours = resolved.length > 0
    ? resolved.reduce((s, r) => {
        const h = (new Date(r.resolvedAt!).getTime() - new Date(`${r.date}T00:00:00Z`).getTime()) / 3_600_000;
        return s + h;
      }, 0) / resolved.length
    : 0;

  return {
    totalRecords:       records.length,
    matchRate:          matched.length / (records.length || 1),
    totalDiscrepancy:   records.reduce((s, r) => s + r.discrepancy, 0),
    openBreaks:         open.length,
    avgResolutionHours: Math.round(avgResHours),
    duplicatesFound:    records.filter(r => r.status === "duplicate").length,
    timingDifferences:  records.filter(r => r.status === "timing_difference").length,
  };
}
