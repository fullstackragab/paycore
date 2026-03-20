import {
  KYCRecord, KYCStatus, KYBStatus,
  AMLAlert, AMLAlertType, AMLAlertStatus,
  ReserveAccount, TreasuryPosition,
  ComplianceMetrics,
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
  return new Date(Date.now() - d * 86_400_000).toISOString();
}

function daysFromNow(d: number): string {
  return new Date(Date.now() + d * 86_400_000).toISOString();
}

function addDays(iso: string, d: number): string {
  return new Date(new Date(iso).getTime() + d * 86_400_000).toISOString();
}

// ─── Static data ──────────────────────────────────────────────────────────────

const INDIVIDUAL_NAMES = [
  "Mohammed Al-Rashid",   "Priya Krishnamurthy", "Hans Müller",
  "Fatima Okonkwo",       "James Wellington",    "Yuki Tanaka",
  "Sara Andersen",        "Carlos Vega",         "Amira Hassan",
  "David Okafor",         "Nina Petrov",         "Ali Hassan",
  "Elena Sokolova",       "Kevin Ochieng",       "Layla Mansour",
];

const BUSINESS_NAMES = [
  "Acme International Ltd",    "Global Trade Partners",   "Meridian Exports LLC",
  "Atlas Capital Group",       "Falcon Investments",      "Blue Nile Trading",
  "Cedar Consulting",          "Delta Logistics SA",      "Apex Fintech Ltd",
  "Summit Payments Inc",       "Horizon Markets",         "Vertex Solutions",
];

const COUNTRIES = ["US", "GB", "EG", "AE", "IN", "NG", "DE", "FR", "SG", "JP", "BR", "ZA"];
const HIGH_RISK = ["NG", "UA", "VN", "RU", "IR", "KP", "SY"];

const DOCUMENTS_INDIVIDUAL = [
  ["Passport", "Proof of address"],
  ["National ID", "Utility bill", "Selfie"],
  ["Driver's license", "Bank statement"],
  ["Passport", "Proof of address", "Tax ID"],
];

const DOCUMENTS_BUSINESS = [
  ["Certificate of incorporation", "Memorandum of association", "UBO declaration"],
  ["Business license", "Audited financials", "Director IDs"],
  ["Articles of association", "Proof of business address", "Bank reference letter"],
];

const REVIEWERS = ["Compliance Team A", "KYC Analyst B", "Senior Analyst C", "AML Officer D"];

const AML_DESCRIPTIONS: Record<AMLAlertType, string> = {
  structuring:               "Multiple transactions just below reporting threshold — possible structuring to avoid CTR filing",
  rapid_movement:            "Funds received and immediately withdrawn within minutes across multiple accounts",
  high_risk_corridor:        "Large volume payments to/from high-risk jurisdiction without clear business purpose",
  round_amount_pattern:      "Repeated round-amount transactions ($1,000, $5,000, $10,000) inconsistent with normal activity",
  dormant_account_activity:  "Account dormant for 180+ days showing sudden high-volume activity",
  unusual_velocity:          "Transaction velocity 10x above historical baseline within 24-hour window",
  pep_transaction:           "Transaction linked to Politically Exposed Person — enhanced due diligence required",
  sanctions_proximity:       "Transaction network analysis reveals second-degree connection to sanctioned entity",
};

const MERCHANTS_RESERVE = [
  "TechShop Online",       "TravelDeals.com",    "GameVault",
  "FashionHub",            "ElectroWorld",       "FoodieBox",
  "StreamFlix",            "FitGear Pro",        "HomeDecor Plus",
];

const CURRENCIES = ["USD", "EUR", "GBP", "AED", "EGP"];

// ─── KYC generator ────────────────────────────────────────────────────────────

export function generateKYCRecords(count: number): KYCRecord[] {
  return Array.from({ length: count }, (_, i) => {
    const isBusinesss = Math.random() > 0.65;
    const country = pick(COUNTRIES);
    const isHighRisk = HIGH_RISK.includes(country);

    const statusRoll = Math.random();
    let status: KYCStatus;
    if (statusRoll < 0.65)      status = "approved";
    else if (statusRoll < 0.78) status = "pending";
    else if (statusRoll < 0.87) status = "needs_review";
    else if (statusRoll < 0.93) status = "rejected";
    else                         status = "expired";

    const createdAt = daysAgo(Math.floor(Math.random() * 180));

    return {
      id:           `KYC-${uid()}`,
      createdAt,
      updatedAt:    addDays(createdAt, Math.floor(Math.random() * 5)),
      customerId:   `CUST-${uid()}`,
      customerName: isBusinesss ? pick(BUSINESS_NAMES) : pick(INDIVIDUAL_NAMES),
      customerType: isBusinesss ? "business" : "individual",
      status,
      riskTier:     isHighRisk ? "high" : Math.random() > 0.7 ? "medium" : "low",
      country,
      documentsSubmitted: isBusinesss
        ? pick(DOCUMENTS_BUSINESS)
        : pick(DOCUMENTS_INDIVIDUAL),
      reviewedBy:   ["approved","rejected"].includes(status) ? pick(REVIEWERS) : undefined,
      reviewedAt:   ["approved","rejected"].includes(status) ? addDays(createdAt, 2) : undefined,
      expiresAt:    status === "approved" ? daysFromNow(365 - Math.floor(Math.random() * 200)) : daysAgo(Math.floor(Math.random() * 30)),
      notes:        status === "rejected" ? pick([
        "Document expired — resubmission required",
        "Address proof not matching — discrepancy flagged",
        "Sanctions hit on name screening — escalated",
        "PEP identified — enhanced due diligence required",
      ]) : undefined,
    };
  });
}

// ─── AML alert generator ──────────────────────────────────────────────────────

export function generateAMLAlerts(count: number): AMLAlert[] {
  const alertTypes: AMLAlertType[] = [
    "structuring", "rapid_movement", "high_risk_corridor",
    "round_amount_pattern", "dormant_account_activity",
    "unusual_velocity", "pep_transaction", "sanctions_proximity",
  ];

  return Array.from({ length: count }, (_, i) => {
    const alertType = pick(alertTypes);

    const statusRoll = Math.random();
    let status: AMLAlertStatus;
    if (statusRoll < 0.25)      status = "open";
    else if (statusRoll < 0.45) status = "investigating";
    else if (statusRoll < 0.55) status = "escalated";
    else if (statusRoll < 0.85) status = "cleared";
    else                         status = "reported";

    const createdAt = daysAgo(Math.floor(Math.random() * 30));
    const sarFiled  = status === "reported" || (status === "escalated" && Math.random() > 0.5);

    return {
      id:               `AML-${uid()}`,
      createdAt,
      customerId:       `CUST-${uid()}`,
      customerName:     pick([...INDIVIDUAL_NAMES, ...BUSINESS_NAMES]),
      alertType,
      status,
      riskScore:        Math.floor(40 + Math.random() * 60),
      transactionCount: Math.floor(3 + Math.random() * 47),
      totalAmount:      cents(100_000_00, 5_000_000_00),
      currency:         "USD",
      description:      AML_DESCRIPTIONS[alertType],
      assignedTo:       status !== "open" ? pick(REVIEWERS) : undefined,
      resolvedAt:       ["cleared", "reported"].includes(status) ? addDays(createdAt, Math.floor(Math.random() * 14 + 1)) : undefined,
      sarFiled,
    };
  });
}

// ─── Reserve accounts ─────────────────────────────────────────────────────────

export function generateReserveAccounts(): ReserveAccount[] {
  return MERCHANTS_RESERVE.map((name) => {
    const reserveRate     = 0.03 + Math.random() * 0.07; // 3–10%
    const required        = cents(500_000_00, 5_000_000_00);
    const current         = Math.floor(required * (0.7 + Math.random() * 0.5));
    const nextRelease     = daysFromNow(Math.floor(Math.random() * 30 + 5));
    const releaseAmount   = Math.floor(current * 0.1);

    return {
      id:                 `RES-${uid()}`,
      merchantId:         `MERCH-${uid()}`,
      merchantName:       name,
      reserveType:        pick(["rolling", "fixed", "capped"] as const),
      reserveRate,
      currentBalance:     current,
      requiredBalance:    required,
      currency:           "USD",
      releaseSchedule:    pick(["Monthly", "Quarterly", "On demand", "Rolling 90d"]),
      nextReleaseDate:    nextRelease,
      nextReleaseAmount:  releaseAmount,
    };
  });
}

// ─── Treasury positions ───────────────────────────────────────────────────────

export function generateTreasuryPositions(): TreasuryPosition[] {
  return CURRENCIES.map((currency) => {
    const nostro    = cents(1_000_000_00, 50_000_000_00);
    const prefunded = cents(500_000_00, 10_000_000_00);
    const reserved  = cents(200_000_00, 5_000_000_00);
    const available = Math.max(0, nostro - prefunded - reserved);

    return {
      currency,
      nostroBalance:    nostro,
      prefundedAmount:  prefunded,
      reservedAmount:   reserved,
      availableAmount:  available,
      pendingInbound:   cents(100_000_00, 5_000_000_00),
      pendingOutbound:  cents(100_000_00, 5_000_000_00),
      lastUpdated:      new Date().toISOString(),
    };
  });
}

// ─── Metrics ──────────────────────────────────────────────────────────────────

export function calcComplianceMetrics(
  kyc: KYCRecord[],
  aml: AMLAlert[],
  reserves: ReserveAccount[]
): ComplianceMetrics {
  return {
    totalKYCRecords:    kyc.length,
    approvedKYC:        kyc.filter(k => k.status === "approved").length,
    pendingKYC:         kyc.filter(k => k.status === "pending").length,
    rejectedKYC:        kyc.filter(k => k.status === "rejected").length,
    openAMLAlerts:      aml.filter(a => ["open","investigating","escalated"].includes(a.status)).length,
    sarsFiled:          aml.filter(a => a.sarFiled).length,
    highRiskCustomers:  kyc.filter(k => k.riskTier === "high").length,
    totalReserveHeld:   reserves.reduce((s, r) => s + r.currentBalance, 0),
  };
}
