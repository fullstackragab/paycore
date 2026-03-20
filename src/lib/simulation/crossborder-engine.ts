import {
  CrossBorderPayment,
  CrossBorderStatus,
  SWIFTMessageType,
  SanctionsResult,
  FXRate,
  CrossBorderMetrics,
  FXConversionType,
} from "@/types/payments";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

function uetr(): string {
  // UUID v4 format used by SWIFT GPI
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
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

function addDays(iso: string, d: number): string {
  return new Date(new Date(iso).getTime() + d * 86_400_000).toISOString();
}

// ─── Static data ──────────────────────────────────────────────────────────────

const CORRIDORS = [
  { senderCountry: "US", receiverCountry: "GB", sendCurrency: "USD", receiveCurrency: "GBP", weight: 4 },
  { senderCountry: "US", receiverCountry: "EU", sendCurrency: "USD", receiveCurrency: "EUR", weight: 5 },
  { senderCountry: "GB", receiverCountry: "IN", sendCurrency: "GBP", receiveCurrency: "INR", weight: 3 },
  { senderCountry: "US", receiverCountry: "EG", sendCurrency: "USD", receiveCurrency: "EGP", weight: 3 },
  { senderCountry: "AE", receiverCountry: "IN", sendCurrency: "AED", receiveCurrency: "INR", weight: 4 },
  { senderCountry: "US", receiverCountry: "MX", sendCurrency: "USD", receiveCurrency: "MXN", weight: 3 },
  { senderCountry: "CH", receiverCountry: "US", sendCurrency: "CHF", receiveCurrency: "USD", weight: 2 },
  { senderCountry: "EU", receiverCountry: "NG", sendCurrency: "EUR", receiveCurrency: "NGN", weight: 2 },
  { senderCountry: "US", receiverCountry: "JP", sendCurrency: "USD", receiveCurrency: "JPY", weight: 2 },
  { senderCountry: "AU", receiverCountry: "US", sendCurrency: "AUD", receiveCurrency: "USD", weight: 2 },
];

// Build weighted array
const WEIGHTED_CORRIDORS = CORRIDORS.flatMap((c) => Array(c.weight).fill(c));

const BANKS: Record<string, { name: string; bic: string }[]> = {
  US: [
    { name: "JPMorgan Chase",    bic: "CHASUS33" },
    { name: "Bank of America",   bic: "BOFAUS3N" },
    { name: "Citibank",          bic: "CITIUS33" },
    { name: "Wells Fargo",       bic: "WFBIUS6S" },
  ],
  GB: [
    { name: "Barclays",          bic: "BARCGB22" },
    { name: "HSBC UK",           bic: "HBUKGB4B" },
    { name: "NatWest",           bic: "NWBKGB2L" },
  ],
  EU: [
    { name: "Deutsche Bank",     bic: "DEUTDEDB" },
    { name: "BNP Paribas",       bic: "BNPAFRPP" },
    { name: "ING",               bic: "INGBNL2A" },
  ],
  EG: [
    { name: "CIB Egypt",         bic: "CIBEEGCX" },
    { name: "NBE Egypt",         bic: "NBEGEGCX" },
    { name: "QNB Al Ahli",       bic: "QNBAEGCX" },
  ],
  AE: [
    { name: "Emirates NBD",      bic: "EBILAEAD" },
    { name: "ADCB",              bic: "ADCBAEAA" },
    { name: "FAB",               bic: "NBADAEAA" },
  ],
  IN: [
    { name: "ICICI Bank",        bic: "ICICINBB" },
    { name: "HDFC Bank",         bic: "HDFCINBB" },
    { name: "SBI",               bic: "SBININBB" },
  ],
  CH: [
    { name: "UBS",               bic: "UBSWCHZH" },
    { name: "Credit Suisse",     bic: "CRESCHZZ" },
  ],
  JP: [
    { name: "MUFG",              bic: "BOTKJPJT" },
    { name: "Mizuho",            bic: "MHCBJPJT" },
  ],
  MX: [
    { name: "BBVA Mexico",       bic: "BCMRMXMM" },
    { name: "Citibanamex",       bic: "BNMXMXMM" },
  ],
  NG: [
    { name: "Zenith Bank",       bic: "ZEIBNGLA" },
    { name: "GTBank",            bic: "GTBINGLA" },
  ],
  AU: [
    { name: "Commonwealth Bank", bic: "CTBAAU2S" },
    { name: "ANZ",               bic: "ANZBAU3M" },
  ],
};

const CORRESPONDENTS = [
  "JPMorgan Chase (New York)",
  "Deutsche Bank (Frankfurt)",
  "HSBC (London)",
  "Citibank (New York)",
  "Standard Chartered (Singapore)",
  "BNY Mellon (New York)",
  "Commerzbank (Frankfurt)",
];

const NOSTRO_ACCOUNTS = [
  "NOSTRO-USD-0012",
  "NOSTRO-EUR-0034",
  "NOSTRO-GBP-0056",
  "NOSTRO-AED-0078",
  "NOSTRO-INR-0090",
];

const SENDER_NAMES = [
  "Acme International Ltd",
  "Global Trade Partners",
  "Meridian Exports LLC",
  "Atlas Capital Group",
  "Falcon Investments",
  "Blue Nile Trading",
  "Cedar Consulting",
];

const RECEIVER_NAMES = [
  "Mohammed Al-Rashid",
  "Priya Krishnamurthy",
  "Hans Müller GmbH",
  "Fatima Okonkwo",
  "Tanaka Electronics Co",
  "Mumbai Software Pvt Ltd",
  "Delta Logistics SA",
];

const PURPOSE_CODES = ["SALA", "SUPP", "TRAD", "SVCS", "REFU", "RINV", "PENS"];
const PURPOSE_DESC: Record<string, string> = {
  SALA: "Salary payment",
  SUPP: "Supplier payment",
  TRAD: "Trade settlement",
  SVCS: "Services payment",
  REFU: "Refund",
  RINV: "Reinvoicing",
  PENS: "Pension payment",
};

// ─── FX rates (realistic mid-market, March 2026) ──────────────────────────────

const BASE_FX_RATES: Record<string, number> = {
  "USD/EUR": 0.9215,
  "USD/GBP": 0.7892,
  "USD/JPY": 149.85,
  "USD/EGP": 49.25,
  "USD/AED": 3.6725,
  "USD/INR": 83.42,
  "USD/CHF": 0.8934,
  "USD/MXN": 17.23,
  "USD/NGN": 1580.0,
  "USD/AUD": 1.5312,
  "GBP/INR": 105.71,
  "EUR/NGN": 1715.0,
  "AED/INR": 22.71,
  "CHF/USD": 1.1194,
  "AUD/USD": 0.6531,
};

function getFXRate(from: string, to: string): number {
  const direct = BASE_FX_RATES[`${from}/${to}`];
  if (direct) return direct;
  const inverse = BASE_FX_RATES[`${to}/${from}`];
  if (inverse) return 1 / inverse;
  // Cross via USD
  const toUSD = BASE_FX_RATES[`${to}/USD`] ? 1 / BASE_FX_RATES[`${to}/USD`] : BASE_FX_RATES[`USD/${to}`] ? 1 / BASE_FX_RATES[`USD/${to}`] : 1;
  const fromUSD = BASE_FX_RATES[`USD/${from}`] ? BASE_FX_RATES[`USD/${from}`] : BASE_FX_RATES[`${from}/USD`] ? 1 / BASE_FX_RATES[`${from}/USD`] : 1;
  return fromUSD * (1 / toUSD);
}

// ─── Single payment factory ───────────────────────────────────────────────────

export function generateCrossBorderPayment(createdAt?: string): CrossBorderPayment {
  const corridor     = pick(WEIGHTED_CORRIDORS);
  const senderBanks  = BANKS[corridor.senderCountry]   ?? BANKS["US"];
  const receiverBanks= BANKS[corridor.receiverCountry] ?? BANKS["EU"];
  const senderBank   = pick(senderBanks);
  const receiverBank = pick(receiverBanks);

  const created      = createdAt ?? hoursAgo(Math.random() * 72);
  const sendAmount   = cents(50_000_00, 500_000_00); // $500 – $5,000 in cents
  const fxRate       = getFXRate(corridor.sendCurrency, corridor.receiveCurrency);
  const fxVariance   = 1 + (Math.random() - 0.5) * 0.002; // ±0.1% variance
  const effectiveRate= fxRate * fxVariance;
  const fxSpread     = sendAmount * 0.0025; // 0.25% FX spread fee
  const liftingFees  = cents(1500, 3500);   // $15–$35 correspondent fees
  const ourFee       = cents(500, 2500);    // $5–$25 originator fee
  const receiveAmount= Math.round((sendAmount - fxSpread - liftingFees) * effectiveRate);

  const needsCorrespondent = !["US","GB","EU"].includes(corridor.senderCountry) ||
                             !["US","GB","EU"].includes(corridor.receiverCountry);

  const isSanctionsHold = Math.random() < 0.03;
  const isFailed        = !isSanctionsHold && Math.random() < 0.04;

  // Build status along timeline
  const elapsedHours = (Date.now() - new Date(created).getTime()) / 3_600_000;

  let status: CrossBorderStatus;
  let complianceCheckedAt: string | undefined;
  let fxConvertedAt: string | undefined;
  let swiftSentAt: string | undefined;
  let creditedAt: string | undefined;
  let sanctionsScreenedAt: string | undefined;

  if (isSanctionsHold) {
    status = "sanctions_hold";
    sanctionsScreenedAt = addHours(created, 0.5);
  } else if (isFailed) {
    status = "failed";
    complianceCheckedAt = addHours(created, 1);
  } else if (elapsedHours < 1) {
    status = "initiated";
  } else if (elapsedHours < 2) {
    status = "compliance_check";
    sanctionsScreenedAt = addHours(created, 0.5);
  } else if (elapsedHours < 4) {
    status = "fx_converted";
    sanctionsScreenedAt = addHours(created, 0.5);
    complianceCheckedAt = addHours(created, 1);
    fxConvertedAt       = addHours(created, 2);
  } else if (elapsedHours < 24) {
    status = "swift_sent";
    sanctionsScreenedAt = addHours(created, 0.5);
    complianceCheckedAt = addHours(created, 1);
    fxConvertedAt       = addHours(created, 2);
    swiftSentAt         = addHours(created, 4);
  } else if (elapsedHours < 48) {
    status = "intermediary_processing";
    sanctionsScreenedAt = addHours(created, 0.5);
    complianceCheckedAt = addHours(created, 1);
    fxConvertedAt       = addHours(created, 2);
    swiftSentAt         = addHours(created, 4);
  } else {
    status = "credited";
    sanctionsScreenedAt = addHours(created, 0.5);
    complianceCheckedAt = addHours(created, 1);
    fxConvertedAt       = addHours(created, 2);
    swiftSentAt         = addHours(created, 4);
    creditedAt          = addHours(created, 48 + Math.random() * 24);
  }

  const purposeCode = pick(PURPOSE_CODES);

  return {
    id:                    `XB-${uid()}`,
    createdAt:             created,
    updatedAt:             new Date().toISOString(),
    senderName:            pick(SENDER_NAMES),
    senderBank:            senderBank.name,
    senderBIC:             senderBank.bic,
    senderCountry:         corridor.senderCountry,
    receiverName:          pick(RECEIVER_NAMES),
    receiverBank:          receiverBank.name,
    receiverBIC:           receiverBank.bic,
    receiverCountry:       corridor.receiverCountry,
    correspondentBank1:    needsCorrespondent ? pick(CORRESPONDENTS) : undefined,
    correspondentBank2:    needsCorrespondent && Math.random() > 0.6 ? pick(CORRESPONDENTS) : undefined,
    nostroAccount:         pick(NOSTRO_ACCOUNTS),
    sendAmount,
    sendCurrency:          corridor.sendCurrency,
    receiveAmount:         Math.max(receiveAmount, 100),
    receiveCurrency:       corridor.receiveCurrency,
    fxRate:                parseFloat(effectiveRate.toFixed(6)),
    fxConversionType:      pick<FXConversionType>(["spot", "spot", "spot", "forward"]),
    fxFee:                 Math.round(fxSpread),
    liftingFees,
    ourFee,
    swiftMessageType:      pick<SWIFTMessageType>(["MT103", "MT103", "MT103", "MT202"]),
    uetr:                  uetr(),
    endToEndRef:           `E2E-${uid()}`,
    sanctionsResult:       isSanctionsHold ? "hold" : "clear" as SanctionsResult,
    sanctionsScreenedAt,
    purposeCode,
    remittanceInfo:        PURPOSE_DESC[purposeCode],
    status,
    failureReason:         isFailed ? pick([
      "Beneficiary account not found",
      "Invalid BIC code",
      "Regulatory restriction on corridor",
      "Amount exceeds reporting threshold without documentation",
    ]) : undefined,
    complianceCheckedAt,
    fxConvertedAt,
    swiftSentAt,
    creditedAt,
    estimatedArrival:      addDays(created, corridor.receiverCountry === "NG" || corridor.receiverCountry === "EG" ? 3 : 2),
    valueDating:           addDays(created, 1),
  };
}

// ─── Batch generator ──────────────────────────────────────────────────────────

export function generateCrossBorderPayments(count: number): CrossBorderPayment[] {
  return Array.from({ length: count }, (_, i) =>
    generateCrossBorderPayment(hoursAgo(i * 2))
  );
}

// ─── FX rate table ────────────────────────────────────────────────────────────

export function generateFXRates(): FXRate[] {
  return Object.entries(BASE_FX_RATES).map(([pair, rate]) => {
    const [base, quote] = pair.split("/");
    const spread = rate * 0.005; // 0.5% spread
    const variance = 1 + (Math.random() - 0.5) * 0.001;
    const mid = rate * variance;
    return {
      pair,
      baseCurrency:  base,
      quoteCurrency: quote,
      rate:          parseFloat(mid.toFixed(6)),
      bid:           parseFloat((mid - spread / 2).toFixed(6)),
      ask:           parseFloat((mid + spread / 2).toFixed(6)),
      spread:        parseFloat(spread.toFixed(6)),
      updatedAt:     new Date().toISOString(),
    };
  });
}

// ─── Metrics ──────────────────────────────────────────────────────────────────

export function calcCrossBorderMetrics(payments: CrossBorderPayment[]): CrossBorderMetrics {
  const credited  = payments.filter((p) => p.status === "credited");
  const avgHours  = credited.length > 0
    ? credited.reduce((s, p) => {
        return s + (new Date(p.creditedAt!).getTime() - new Date(p.createdAt).getTime()) / 3_600_000;
      }, 0) / credited.length
    : 0;

  const corridorMap: Record<string, { count: number; volume: number }> = {};
  payments.forEach((p) => {
    const key = `${p.senderCountry}→${p.receiverCountry}`;
    if (!corridorMap[key]) corridorMap[key] = { count: 0, volume: 0 };
    corridorMap[key].count++;
    corridorMap[key].volume += p.sendAmount;
  });

  return {
    totalVolume:          payments.reduce((s, p) => s + p.sendAmount, 0),
    totalCount:           payments.length,
    avgProcessingHours:   Math.round(avgHours),
    sanctionsHoldCount:   payments.filter((p) => p.status === "sanctions_hold").length,
    failedCount:          payments.filter((p) => p.status === "failed").length,
    totalFXFees:          payments.reduce((s, p) => s + p.fxFee, 0),
    totalLiftingFees:     payments.reduce((s, p) => s + p.liftingFees, 0),
    corridors:            Object.entries(corridorMap)
      .sort(([, a], [, b]) => b.volume - a.volume)
      .map(([key, val]) => {
        const [from, to] = key.split("→");
        return { from, to, ...val };
      }),
  };
}
