import {
  RiskEvent,
  RiskDecision,
  FraudCase,
  FraudType,
  RiskRule,
  RiskMetrics,
  ReviewStatus,
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

// ─── Static data ──────────────────────────────────────────────────────────────

const MERCHANTS = [
  "Amazon", "Uber", "Netflix", "Apple Store", "Noon",
  "Booking.com", "Starbucks", "Talabat", "Spotify", "Steam",
  "Binance", "Coinbase", "Western Union", "MoneyGram",
];

const DEVICE_FINGERPRINTS = Array.from({ length: 20 }, () =>
  Math.random().toString(36).slice(2, 18).toUpperCase()
);

const COUNTRIES = ["US", "GB", "EG", "AE", "IN", "NG", "RU", "CN", "BR", "MX", "UA", "VN"];
const HIGH_RISK_COUNTRIES = new Set(["NG", "UA", "VN", "RU"]);

const FRAUD_TYPES: FraudType[] = [
  "card_not_present",
  "account_takeover",
  "friendly_fraud",
  "identity_theft",
  "merchant_fraud",
  "mule_account",
  "social_engineering",
  "velocity_abuse",
];

const REVIEW_AGENTS = ["Sarah K.", "Omar H.", "Priya S.", "James W.", "Amira T."];

// ─── Rule definitions ─────────────────────────────────────────────────────────

export const RISK_RULES: RiskRule[] = [
  {
    id: "VEL-001",
    name: "High velocity — same card",
    description: "More than 5 transactions on the same card within 10 minutes",
    action: "decline",
    isActive: true,
    triggeredCount: 0,
    falsePositiveRate: 0.08,
    category: "velocity",
  },
  {
    id: "VEL-002",
    name: "Velocity — multiple merchants",
    description: "More than 3 different merchants within 5 minutes",
    action: "flag",
    isActive: true,
    triggeredCount: 0,
    falsePositiveRate: 0.15,
    category: "velocity",
  },
  {
    id: "GEO-001",
    name: "Country mismatch",
    description: "IP country does not match card issuing country",
    action: "challenge",
    isActive: true,
    triggeredCount: 0,
    falsePositiveRate: 0.35,
    category: "geo",
  },
  {
    id: "GEO-002",
    name: "High-risk country",
    description: "Transaction originates from a high-risk IP country",
    action: "flag",
    isActive: true,
    triggeredCount: 0,
    falsePositiveRate: 0.42,
    category: "geo",
  },
  {
    id: "GEO-003",
    name: "Impossible travel",
    description: "Same card used in two countries within 2 hours",
    action: "decline",
    isActive: true,
    triggeredCount: 0,
    falsePositiveRate: 0.05,
    category: "geo",
  },
  {
    id: "DEV-001",
    name: "New device — high amount",
    description: "First transaction on this device and amount > $500",
    action: "challenge",
    isActive: true,
    triggeredCount: 0,
    falsePositiveRate: 0.28,
    category: "device",
  },
  {
    id: "DEV-002",
    name: "VPN or proxy detected",
    description: "Transaction IP resolved to a known VPN or proxy service",
    action: "flag",
    isActive: true,
    triggeredCount: 0,
    falsePositiveRate: 0.55,
    category: "device",
  },
  {
    id: "AMT-001",
    name: "Large round amount",
    description: "Transaction amount is a large round number (e.g. $1000, $5000)",
    action: "flag",
    isActive: true,
    triggeredCount: 0,
    falsePositiveRate: 0.62,
    category: "amount",
  },
  {
    id: "AMT-002",
    name: "Amount exceeds 3x avg",
    description: "Transaction amount is more than 3x the cardholder's average",
    action: "challenge",
    isActive: true,
    triggeredCount: 0,
    falsePositiveRate: 0.22,
    category: "amount",
  },
  {
    id: "BEH-001",
    name: "Unusual hour",
    description: "Transaction between 2am–5am local time (high fraud window)",
    action: "flag",
    isActive: true,
    triggeredCount: 0,
    falsePositiveRate: 0.45,
    category: "behavioral",
  },
  {
    id: "BEH-002",
    name: "High-risk merchant category",
    description: "Merchant is in a high-risk MCC (crypto, gambling, money transfer)",
    action: "flag",
    isActive: false,
    triggeredCount: 0,
    falsePositiveRate: 0.38,
    category: "behavioral",
  },
];

// ─── Score calculator ─────────────────────────────────────────────────────────

function calcRiskScore(signals: {
  isNewDevice: boolean;
  isVPNOrProxy: boolean;
  isHighRiskCountry: boolean;
  isUnusualHour: boolean;
  isUnusualAmount: boolean;
  velocityBreached: boolean;
  countryMismatch: boolean;
}): number {
  let score = 100; // baseline
  if (signals.isNewDevice)        score += 120;
  if (signals.isVPNOrProxy)       score += 180;
  if (signals.isHighRiskCountry)  score += 200;
  if (signals.isUnusualHour)      score += 80;
  if (signals.isUnusualAmount)    score += 150;
  if (signals.velocityBreached)   score += 300;
  if (signals.countryMismatch)    score += 170;
  // Add noise
  score += Math.floor((Math.random() - 0.5) * 60);
  return Math.min(1000, Math.max(0, score));
}

function getRulesTriggered(signals: {
  isNewDevice: boolean;
  isVPNOrProxy: boolean;
  isHighRiskCountry: boolean;
  isUnusualHour: boolean;
  isUnusualAmount: boolean;
  velocityBreached: boolean;
  countryMismatch: boolean;
  amount: number;
}): string[] {
  const rules: string[] = [];
  if (signals.velocityBreached)                      rules.push("VEL-001");
  if (signals.countryMismatch)                       rules.push("GEO-001");
  if (signals.isHighRiskCountry)                     rules.push("GEO-002");
  if (signals.isNewDevice && signals.amount > 50000) rules.push("DEV-001");
  if (signals.isVPNOrProxy)                          rules.push("DEV-002");
  if (signals.isUnusualAmount)                       rules.push("AMT-002");
  if (signals.isUnusualHour)                         rules.push("BEH-001");
  return rules;
}

function scoreToDecision(score: number): RiskDecision {
  if (score >= 700) return "decline";
  if (score >= 500) return "review";
  if (score >= 350) return "challenge_3ds";
  return "approve";
}

// ─── Single event factory ─────────────────────────────────────────────────────

export function generateRiskEvent(createdAt?: string): RiskEvent {
  const created          = createdAt ?? hoursAgo(Math.random() * 48);
  const ipCountry        = pick(COUNTRIES);
  const cardCountry      = pick(COUNTRIES);
  const countryMismatch  = ipCountry !== cardCountry && Math.random() > 0.4;
  const isHighRisk       = HIGH_RISK_COUNTRIES.has(ipCountry);
  const isNewDevice      = Math.random() < 0.2;
  const isVPN            = Math.random() < 0.12;
  const isUnusualHour    = new Date(created).getHours() < 5;
  const velocityBreached = Math.random() < 0.08;
  const amount           = cents(500, 500_000);
  const isUnusualAmount  = amount > 200_000;

  const signals = {
    isNewDevice,
    isVPNOrProxy:      isVPN,
    isHighRiskCountry: isHighRisk,
    isUnusualHour,
    isUnusualAmount,
    velocityBreached,
    countryMismatch,
    amount,
  };

  const riskScore         = calcRiskScore(signals);
  const fraudProbability  = Math.min(0.99, riskScore / 1000 + Math.random() * 0.05);
  const decision          = scoreToDecision(riskScore);
  const rulesTriggered    = getRulesTriggered(signals);

  let reviewStatus: ReviewStatus | undefined;
  let reviewedBy: string | undefined;
  let reviewedAt: string | undefined;
  let reviewNote: string | undefined;
  let isFraudConfirmed: boolean | undefined;
  let fraudType: FraudType | undefined;

  if (decision === "review") {
    const r = Math.random();
    if (r < 0.3) {
      reviewStatus = "pending";
    } else if (r < 0.6) {
      reviewStatus  = "approved";
      reviewedBy    = pick(REVIEW_AGENTS);
      reviewedAt    = addHours(created, Math.random() * 4 + 0.5);
      reviewNote    = "Verified with customer — legitimate transaction";
      isFraudConfirmed = false;
    } else if (r < 0.85) {
      reviewStatus  = "declined";
      reviewedBy    = pick(REVIEW_AGENTS);
      reviewedAt    = addHours(created, Math.random() * 2 + 0.5);
      reviewNote    = "Confirmed fraud signals — declined and card blocked";
      isFraudConfirmed = true;
      fraudType     = pick(FRAUD_TYPES);
    } else {
      reviewStatus  = "escalated";
      reviewedBy    = pick(REVIEW_AGENTS);
      reviewedAt    = addHours(created, Math.random() * 1 + 0.2);
      reviewNote    = "Escalated to senior analyst — multiple high-risk signals";
    }
  }

  return {
    id:                 `RISK-${uid()}`,
    createdAt:          created,
    transactionId:      `TXN-${uid()}`,
    riskScore,
    fraudProbability,
    deviceScore:        isNewDevice ? Math.floor(Math.random() * 30) : Math.floor(70 + Math.random() * 30),
    velocityScore:      velocityBreached ? Math.floor(70 + Math.random() * 30) : Math.floor(Math.random() * 30),
    isNewDevice,
    isVPNOrProxy:       isVPN,
    isHighRiskCountry:  isHighRisk,
    isUnusualHour,
    isUnusualAmount,
    velocityBreached,
    deviceFingerprint:  pick(DEVICE_FINGERPRINTS),
    ipCountry,
    cardCountry,
    countryMismatch,
    decision,
    rulesTriggered,
    reviewStatus,
    reviewedBy,
    reviewedAt,
    reviewNote,
    isFraudConfirmed,
    fraudType,
    amount,
    merchantName:       pick(MERCHANTS),
  };
}

// ─── Batch generators ─────────────────────────────────────────────────────────

export function generateRiskEvents(count: number): RiskEvent[] {
  return Array.from({ length: count }, (_, i) =>
    generateRiskEvent(hoursAgo(i * 0.4))
  );
}

export function generateFraudCases(events: RiskEvent[]): FraudCase[] {
  return events
    .filter((e) => e.isFraudConfirmed && e.fraudType)
    .map((e) => {
      const recovered = Math.floor(e.amount * Math.random() * 0.4);
      return {
        id:             `FRAUD-${uid()}`,
        createdAt:      e.createdAt,
        transactionId:  e.transactionId,
        fraudType:      e.fraudType!,
        amount:         e.amount,
        currency:       "USD",
        merchantName:   e.merchantName,
        status:         pick(["open", "investigating", "confirmed", "dismissed"] as const),
        lossAmount:     e.amount - recovered,
        recoveredAmount: recovered,
      };
    });
}

export function generateRiskRules(): RiskRule[] {
  return RISK_RULES.map((r) => ({
    ...r,
    triggeredCount: cents(10, 2000),
  }));
}

// ─── Metrics ──────────────────────────────────────────────────────────────────

export function calcRiskMetrics(events: RiskEvent[]): RiskMetrics {
  const approved  = events.filter((e) => e.decision === "approve");
  const declined  = events.filter((e) => e.decision === "decline");
  const reviewed  = events.filter((e) => e.decision === "review");
  const confirmed = events.filter((e) => e.isFraudConfirmed);

  const fraudLoss = confirmed.reduce((s, e) => s + e.amount, 0);
  const falsePos  = reviewed.filter((e) => e.reviewStatus === "approved");

  return {
    totalEventsReviewed: events.length,
    approvalRate:        approved.length / (events.length || 1),
    declineRate:         declined.length / (events.length || 1),
    reviewRate:          reviewed.length / (events.length || 1),
    fraudRate:           confirmed.length / (events.length || 1),
    falsePositiveRate:   falsePos.length / (reviewed.length || 1),
    fraudLoss,
    recoveredAmount:     Math.floor(fraudLoss * 0.22),
    avgRiskScore:        Math.round(events.reduce((s, e) => s + e.riskScore, 0) / (events.length || 1)),
  };
}
