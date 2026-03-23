import { NextRequest, NextResponse } from "next/server";

// ─── In-memory transaction log ────────────────────────────────────────────────
const txnLog: unknown[] = [];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 10).toUpperCase(); }
function stan() { return String(Math.floor(Math.random() * 999999)).padStart(6, "0"); }
function authCode() { return Math.random().toString(36).slice(2, 8).toUpperCase(); }
function rrn() { return String(Math.floor(Math.random() * 999999999999)).padStart(12, "0"); }
function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function luhnCheck(pan: string): boolean {
  const digits = pan.replace(/\s/g, "").split("").map(Number);
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits[i];
    if (alt) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function detectNetwork(pan: string): string {
  const p = pan.replace(/\s/g, "");
  if (p.startsWith("4")) return "Visa";
  if (p.startsWith("5")) return "Mastercard";
  if (p.startsWith("34") || p.startsWith("37")) return "Amex";
  if (p.startsWith("6")) return "Discover";
  return "Unknown";
}

function calcInterchange(amount: number, network: string): number {
  const rates: Record<string, number> = { Visa: 0.018, Mastercard: 0.0175, Amex: 0.025, Discover: 0.016 };
  return Math.round(amount * (rates[network] ?? 0.018));
}

function calcRiskScore(input: {
  amount: number;
  isContactless: boolean;
  merchantMCC: string;
  hour: number;
}): { score: number; signals: string[] } {
  let score = 100;
  const signals: string[] = [];
  if (input.amount > 50000) { score += 150; signals.push("High amount"); }
  if (input.hour < 6 || input.hour > 23) { score += 80; signals.push("Unusual hour"); }
  if (["7995", "6211", "5813"].includes(input.merchantMCC)) { score += 120; signals.push("High-risk MCC"); }
  if (!input.isContactless) { score += 40; signals.push("Card inserted (not tap)"); }
  score += Math.floor(Math.random() * 40);
  return { score: Math.min(score, 1000), signals };
}

function issuerDecision(
  score: number,
  amount: number,
  expiry: string
): { approved: boolean; responseCode: string; reason: string } {
  // Check expiry
  const [mm, yy] = expiry.split("/");
  const expDate = new Date(2000 + Number(yy), Number(mm) - 1, 1);
  if (expDate < new Date()) {
    return { approved: false, responseCode: "54", reason: "Expired card" };
  }
  // Risk-based decline
  if (score > 700) {
    return { approved: false, responseCode: "05", reason: "Do not honor — fraud suspected" };
  }
  if (amount > 200000) {
    return { approved: false, responseCode: "61", reason: "Exceeds withdrawal limit" };
  }
  // 8% random decline to simulate real decline rates
  if (Math.random() < 0.08) {
    const declines = [
      { responseCode: "51", reason: "Insufficient funds" },
      { responseCode: "05", reason: "Do not honor" },
      { responseCode: "91", reason: "Issuer unavailable" },
    ];
    return { approved: false, ...declines[Math.floor(Math.random() * declines.length)] };
  }
  return { approved: true, responseCode: "00", reason: "Approved" };
}

// ─── POS processing engine ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { pan, expiry, cvv, amount, merchantName, merchantMCC, isContactless } = body;

  const amountCents = Math.round(parseFloat(amount) * 100);
  const network = detectNetwork(pan);
  const stanNum = stan();
  const rrnNum = rrn();
  const txnId = `TXN-${uid()}`;
  const hour = new Date().getHours();

  const stages = [];

  // ── Stage 1: Card read ───────────────────────────────────────────────────
  await delay(600);
  const panValid = luhnCheck(pan.replace(/\s/g, ""));
  stages.push({
    id: "card_read",
    label: "Card read",
    status: panValid ? "success" : "failed",
    duration: 600,
    customer: panValid
      ? `${isContactless ? "Tap" : "Chip"} detected. Reading card data...`
      : "Card read error. Please try again.",
    system: {
      title: "POS Terminal → Gateway",
      fields: [
        { label: "PAN", value: pan.replace(/\s/g, "").replace(/(\d{4})/g, "$1 ").trim(), sensitive: true },
        { label: "Expiry", value: expiry },
        { label: "Entry mode", value: isContactless ? "071 — Contactless NFC" : "051 — Chip" },
        { label: "Network detected", value: network },
        { label: "Luhn check", value: panValid ? "✓ Pass" : "✗ Fail" },
        { label: "CVV present", value: cvv ? "Yes" : "No" },
      ],
      note: panValid
        ? "PAN passed Luhn algorithm check. Card data encrypted and forwarded to gateway."
        : "PAN failed Luhn check — invalid card number.",
    },
  });

  if (!panValid) {
    return NextResponse.json({ txnId, stages, approved: false, declineReason: "Invalid card number" });
  }

  // ── Stage 2: ISO 8583 Auth Request ──────────────────────────────────────
  await delay(400);
  const interchange = calcInterchange(amountCents, network);
  const schemeFee = 4;
  const processingFee = Math.round(amountCents * 0.003);

  stages.push({
    id: "auth_request",
    label: "Auth request",
    status: "success",
    duration: 400,
    customer: "Connecting to payment network...",
    system: {
      title: "ISO 8583 — MTI 0100 (Authorization Request)",
      fields: [
        { label: "MTI", value: "0100 — Auth request" },
        { label: "DE 2  PAN", value: `${pan.replace(/\s/g,"").slice(0,6)}******${pan.replace(/\s/g,"").slice(-4)}` },
        { label: "DE 3  Processing code", value: "000000 — Purchase" },
        { label: "DE 4  Amount", value: `${String(amountCents).padStart(12, "0")} (${network === "Amex" ? "cents" : "cents"})` },
        { label: "DE 11 STAN", value: stanNum },
        { label: "DE 14 Expiry", value: expiry.replace("/", "") },
        { label: "DE 18 MCC", value: merchantMCC },
        { label: "DE 22 Entry mode", value: isContactless ? "071" : "051" },
        { label: "DE 37 RRN", value: rrnNum },
        { label: "DE 41 Terminal ID", value: "TERM-0042" },
        { label: "DE 42 Merchant ID", value: `MERCH-${uid()}` },
        { label: "DE 43 Merchant name", value: merchantName.toUpperCase() },
        { label: "DE 49 Currency", value: "840 (USD)" },
      ],
      note: `Message routed via ${network} network to BIN lookup → issuing bank. Round-trip SLA: < 3 seconds.`,
    },
  });

  // ── Stage 3: Risk scoring ────────────────────────────────────────────────
  await delay(300);
  const { score, signals } = calcRiskScore({ amount: amountCents, isContactless, merchantMCC, hour });
  const riskLevel = score > 500 ? "high" : score > 300 ? "medium" : "low";

  stages.push({
    id: "risk_score",
    label: "Risk check",
    status: riskLevel === "high" ? "warning" : "success",
    duration: 300,
    customer: "Verifying transaction...",
    system: {
      title: "Risk Engine — Real-time scoring",
      fields: [
        { label: "Risk score", value: `${score} / 1000` },
        { label: "Risk level", value: riskLevel.toUpperCase() },
        { label: "Signals triggered", value: signals.length > 0 ? signals.join(", ") : "None" },
        { label: "Amount check", value: amountCents > 50000 ? "⚠ High amount" : "✓ Normal" },
        { label: "Hour check", value: (hour < 6 || hour > 23) ? "⚠ Unusual hour" : "✓ Normal" },
        { label: "MCC risk", value: ["7995","6211","5813"].includes(merchantMCC) ? "⚠ High-risk MCC" : "✓ Normal MCC" },
        { label: "Decision", value: score > 700 ? "DECLINE" : score > 500 ? "CHALLENGE" : "APPROVE" },
      ],
      note: score > 700
        ? "Score exceeds decline threshold (700). Sending decline to issuer recommendation."
        : "Score within acceptable range. Forwarding auth request to issuing bank.",
    },
  });

  // ── Stage 4: Issuer decision ─────────────────────────────────────────────
  await delay(800);
  const decision = issuerDecision(score, amountCents, expiry);
  const aCode = decision.approved ? authCode() : undefined;

  stages.push({
    id: "issuer_decision",
    label: "Issuer decision",
    status: decision.approved ? "success" : "failed",
    duration: 800,
    customer: decision.approved
      ? "Payment approved!"
      : `Payment declined — ${decision.reason}`,
    system: {
      title: "ISO 8583 — MTI 0110 (Authorization Response)",
      fields: [
        { label: "MTI", value: "0110 — Auth response" },
        { label: "DE 11 STAN", value: stanNum },
        { label: "DE 37 RRN", value: rrnNum },
        { label: "DE 38 Auth code", value: aCode ?? "— (not issued)" },
        { label: "DE 39 Response code", value: `${decision.responseCode} — ${decision.reason}` },
        { label: "Action code", value: decision.approved ? "APPROVE — hold placed on account" : "DECLINE — no hold" },
        { label: "Available balance", value: decision.approved ? "Checked — hold applied" : "N/A" },
      ],
      note: decision.approved
        ? `Issuer placed authorization hold of $${(amountCents/100).toFixed(2)} on cardholder account. No money has moved yet.`
        : `Issuer declined. Response code ${decision.responseCode} returned to acquirer → gateway → terminal.`,
    },
  });

  // ── Stage 5: Receipt + ledger (approved only) ────────────────────────────
  if (decision.approved) {
    await delay(300);
    const netSettlement = amountCents - interchange - schemeFee - processingFee;

    stages.push({
      id: "receipt",
      label: "Receipt",
      status: "success",
      duration: 300,
      customer: `✓ Approved — $${(amountCents/100).toFixed(2)}\nAuth code: ${aCode}\n${merchantName}`,
      system: {
        title: "Ledger entries + receipt",
        fields: [
          { label: "Transaction ID", value: txnId },
          { label: "Auth code", value: aCode! },
          { label: "RRN", value: rrnNum },
          { label: "Gross amount", value: `$${(amountCents/100).toFixed(2)}` },
          { label: "Interchange fee", value: `-$${(interchange/100).toFixed(2)} (${network} rate)` },
          { label: "Scheme fee", value: `-$${(schemeFee/100).toFixed(2)}` },
          { label: "Processing fee", value: `-$${(processingFee/100).toFixed(2)}` },
          { label: "Net to merchant", value: `$${(netSettlement/100).toFixed(2)}` },
          { label: "Settlement", value: "T+1 to T+2 (next batch)" },
          { label: "Status", value: "AUTHORIZED — pending capture" },
        ],
        note: "Authorization hold placed. Capture will occur at end of merchant batch. Settlement T+1 to T+2.",
      },
    });

    // Save to log
    txnLog.push({
      txnId, type: "POS", merchantName, amount: amountCents,
      network, authCode: aCode, rrn: rrnNum, stan: stanNum,
      status: "authorized", createdAt: new Date().toISOString(),
    });
  }

  return NextResponse.json({
    txnId, stages,
    approved: decision.approved,
    authCode: aCode,
    responseCode: decision.responseCode,
    declineReason: decision.approved ? null : decision.reason,
    fees: decision.approved ? { interchange, schemeFee, processingFee, netSettlement: amountCents - interchange - schemeFee - processingFee } : null,
  });
}

export async function GET() {
  return NextResponse.json({ recentTransactions: txnLog.slice(-20) });
}
