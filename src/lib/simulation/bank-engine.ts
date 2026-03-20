import {
  BankTransfer,
  BankTransferType,
  BankTransferStatus,
  ACHReturnCode,
  ACHBatch,
  BankMetrics,
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

function addHours(iso: string, h: number): string {
  return new Date(new Date(iso).getTime() + h * 3_600_000).toISOString();
}

function toDateStr(iso: string): string {
  return iso.slice(0, 10);
}

// ─── Static data ──────────────────────────────────────────────────────────────

const SENDERS = [
  { name: "Acme Corp",         bank: "Chase",           last4: "4821" },
  { name: "Globex LLC",        bank: "Bank of America", last4: "7734" },
  { name: "Initech Ltd",       bank: "Wells Fargo",     last4: "2291" },
  { name: "Umbrella Inc",      bank: "Citibank",        last4: "6603" },
  { name: "Stark Industries",  bank: "JPMorgan",        last4: "9912" },
  { name: "Wayne Enterprises", bank: "HSBC",            last4: "3347" },
  { name: "Vandelay Export",   bank: "TD Bank",         last4: "5519" },
];

const RECEIVERS = [
  { name: "John Mitchell",     bank: "Chase",           last4: "1122" },
  { name: "Sara Okonkwo",      bank: "Ally Bank",       last4: "8834" },
  { name: "Omar Haddad",       bank: "CIB Egypt",       last4: "4490" },
  { name: "Priya Sharma",      bank: "HDFC Bank",       last4: "7751" },
  { name: "Carlos Vega",       bank: "BBVA",            last4: "3368" },
  { name: "Tech Payroll LLC",  bank: "Silicon Valley B",last4: "6620" },
  { name: "Vendor Solutions",  bank: "First Republic",  last4: "9943" },
  { name: "Freelancer Payout", bank: "Mercury",         last4: "2257" },
];

const DESCRIPTIONS = [
  "Payroll disbursement",
  "Vendor payment",
  "Invoice settlement",
  "Subscription renewal",
  "Contractor payment",
  "Refund processing",
  "Expense reimbursement",
  "Commission payout",
  "Rent payment",
  "Insurance premium",
];

const RETURN_CODES: ACHReturnCode[] = [
  "R01", "R02", "R03", "R04", "R05",
  "R07", "R08", "R10", "R16", "R29",
];

const RETURN_DESCRIPTIONS: Record<ACHReturnCode, string> = {
  R01: "Insufficient funds",
  R02: "Account closed",
  R03: "No account / unable to locate account",
  R04: "Invalid account number",
  R05: "Unauthorized debit entry",
  R07: "Authorization revoked by customer",
  R08: "Payment stopped",
  R10: "Customer advises entry not authorized",
  R16: "Account frozen",
  R29: "Corporate customer advises not authorized",
  R61: "Misrouted return",
};

// ─── Settlement timing by type ────────────────────────────────────────────────

const SETTLEMENT_HOURS: Record<BankTransferType, [number, number]> = {
  ach_credit:  [24, 72],   // T+1 to T+3
  ach_debit:   [48, 96],   // T+2 to T+4 (debit pulls take longer)
  wire:        [2,  6],    // Same day, hours
  rtp:         [0,  0.5],  // Near-instant
  sepa_credit: [24, 48],   // T+1
  sepa_debit:  [48, 72],   // T+2
};

// ─── Single transfer factory ──────────────────────────────────────────────────

export function generateBankTransfer(createdAt?: string): BankTransfer {
  const sender   = pick(SENDERS);
  const receiver = pick(RECEIVERS);
  const type     = pick<BankTransferType>([
    "ach_credit", "ach_credit", "ach_credit",   // weighted higher
    "ach_debit",  "ach_debit",
    "wire",
    "rtp",
    "sepa_credit",
  ]);

  const isReturn    = type.startsWith("ach") && Math.random() < 0.08;
  const isSameDay   = type.startsWith("ach") && Math.random() < 0.25;
  const isIntl      = type.startsWith("sepa") || Math.random() < 0.1;

  const [minH, maxH] = SETTLEMENT_HOURS[type];
  const settlementH  = minH + Math.random() * (maxH - minH);

  const created    = createdAt ?? hoursAgo(Math.random() * 96);
  const submitted  = addHours(created, 0.5);
  const settledAt  = addHours(created, isSameDay ? settlementH * 0.4 : settlementH);
  const isSettled  = new Date(settledAt) < new Date();

  let status: BankTransferStatus;
  let returnCode: ACHReturnCode | undefined;
  let returnDescription: string | undefined;
  let returnedAt: string | undefined;

  if (isReturn && isSettled) {
    status            = "returned";
    returnCode        = pick(RETURN_CODES);
    returnDescription = RETURN_DESCRIPTIONS[returnCode];
    returnedAt        = addHours(settledAt, Math.random() * 48 + 24);
  } else if (!isSettled) {
    const progress = Math.random();
    if (progress < 0.2) status = "initiated";
    else if (progress < 0.5) status = "submitted";
    else status = "pending_settlement";
  } else {
    status = "settled";
  }

  const amountRange = type === "wire"
    ? [500_000, 50_000_000]   // wires are large
    : type === "rtp"
    ? [100, 100_000_00]       // RTP up to $1M
    : [5_000, 500_000];       // ACH / SEPA

  return {
    id:                     `ACH-${uid()}`,
    createdAt:              created,
    updatedAt:              new Date().toISOString(),
    senderName:             sender.name,
    senderBank:             sender.bank,
    senderAccountLast4:     sender.last4,
    receiverName:           receiver.name,
    receiverBank:           receiver.bank,
    receiverAccountLast4:   receiver.last4,
    type,
    amount:                 cents(amountRange[0], amountRange[1]),
    currency:               isIntl ? pick(["EUR", "GBP"]) : "USD",
    description:            pick(DESCRIPTIONS),
    companyEntryDescription: pick(["PAYROLL", "VENDOR PMT", "REFUND", "INVOICE", "CONTRACT"]),
    status,
    returnCode,
    returnDescription,
    traceNumber:            `${Math.floor(Math.random() * 1e15)}`.slice(0, 15),
    effectiveDate:          toDateStr(settledAt),
    submittedAt:            submitted,
    settledAt:              isSettled ? settledAt : undefined,
    returnedAt,
    isSameDayACH:           isSameDay,
    isInternational:        isIntl,
    prenoteRequired:        type === "ach_debit" && Math.random() < 0.3,
    prenoteVerifiedAt:      Math.random() > 0.5 ? hoursAgo(48) : undefined,
  };
}

// ─── Batch generator ──────────────────────────────────────────────────────────

export function generateBankTransfers(count: number): BankTransfer[] {
  return Array.from({ length: count }, (_, i) =>
    generateBankTransfer(hoursAgo(i * 1.5))
  );
}

// ─── ACH batch generator ──────────────────────────────────────────────────────

export function generateACHBatches(): ACHBatch[] {
  return Array.from({ length: 6 }, (_, i) => {
    const count      = cents(50, 400);
    const returnRate = Math.random() * 0.06;
    const credit     = cents(100_000_00, 500_000_00);
    const debit      = cents(50_000_00, 200_000_00);
    const date       = new Date(Date.now() - i * 86_400_000);
    return {
      id:               `BATCH-${uid()}`,
      createdAt:        date.toISOString(),
      companyName:      pick(SENDERS).name,
      entryDescription: pick(["PAYROLL", "VENDOR PMT", "INVOICE"]),
      effectiveDate:    toDateStr(addHours(date.toISOString(), 24)),
      transferCount:    count,
      totalDebit:       debit,
      totalCredit:      credit,
      status:           i === 0 ? "processing" : i === 1 ? "submitted" : "settled",
      returnCount:      Math.floor(count * returnRate),
      returnRate,
    };
  });
}

// ─── Metrics ──────────────────────────────────────────────────────────────────

export function calcBankMetrics(transfers: BankTransfer[]): BankMetrics {
  const settled  = transfers.filter((t) => t.status === "settled");
  const returned = transfers.filter((t) => t.status === "returned");
  const pending  = transfers.filter((t) =>
    ["initiated", "submitted", "pending_settlement"].includes(t.status)
  );

  const totalVolume = transfers.reduce((s, t) => s + t.amount, 0);

  const avgSettlementHours = settled.length > 0
    ? settled.reduce((s, t) => {
        const h = (new Date(t.settledAt!).getTime() - new Date(t.createdAt).getTime()) / 3_600_000;
        return s + h;
      }, 0) / settled.length
    : 0;

  return {
    totalVolume,
    totalCount:          transfers.length,
    settledCount:        settled.length,
    returnRate:          returned.length / (transfers.length || 1),
    avgSettlementHours:  Math.round(avgSettlementHours),
    pendingVolume:       pending.reduce((s, t) => s + t.amount, 0),
    returnedVolume:      returned.reduce((s, t) => s + t.amount, 0),
    sameDayCount:        transfers.filter((t) => t.isSameDayACH).length,
  };
}
