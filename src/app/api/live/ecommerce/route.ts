import { NextRequest, NextResponse } from "next/server";

const txnLog: unknown[] = [];

function uid() { return Math.random().toString(36).slice(2, 10).toUpperCase(); }
function stan() { return String(Math.floor(Math.random() * 999999)).padStart(6, "0"); }
function authCode() { return Math.random().toString(36).slice(2, 8).toUpperCase(); }
function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function detectNetwork(pan: string): string {
  const p = pan.replace(/\s/g, "");
  if (p.startsWith("4")) return "Visa";
  if (p.startsWith("5")) return "Mastercard";
  if (p.startsWith("34") || p.startsWith("37")) return "Amex";
  return "Discover";
}

function luhnCheck(pan: string): boolean {
  const digits = pan.replace(/\s/g, "").split("").map(Number);
  let sum = 0; let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits[i];
    if (alt) { d *= 2; if (d > 9) d -= 9; }
    sum += d; alt = !alt;
  }
  return sum % 10 === 0;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { pan, expiry, cvv, cardholderName, amount, merchantName, billingZip } = body;

  const amountCents = Math.round(parseFloat(amount) * 100);
  const network = detectNetwork(pan);
  const stanNum = stan();
  const txnId = `TXN-${uid()}`;
  const token = `tok_${uid().toLowerCase()}${uid().toLowerCase()}`;
  const stages = [];

  // ── Stage 1: Card entry validation ──────────────────────────────────────
  await delay(400);
  const panValid = luhnCheck(pan.replace(/\s/g, ""));
  const cvvValid = cvv.length >= 3;
  const [mm, yy] = expiry.split("/");
  const expiryValid = new Date(2000 + Number(yy), Number(mm) - 1) >= new Date();

  const inputValid = panValid && cvvValid && expiryValid;

  stages.push({
    id: "card_entry",
    label: "Card entry",
    status: inputValid ? "success" : "failed",
    duration: 400,
    customer: inputValid
      ? `Card details validated\n${cardholderName}\n**** **** **** ${pan.replace(/\s/g,"").slice(-4)}`
      : !panValid ? "Invalid card number" : !expiryValid ? "Card has expired" : "Invalid CVV",
    system: {
      title: "Client-side validation",
      fields: [
        { label: "PAN", value: `**** **** **** ${pan.replace(/\s/g,"").slice(-4)}` },
        { label: "Luhn check", value: panValid ? "Pass" : "Fail" },
        { label: "Expiry check", value: expiryValid ? "Valid" : "Expired" },
        { label: "CVV format", value: cvvValid ? "Valid" : "Invalid" },
        { label: "Cardholder name", value: cardholderName },
        { label: "Billing ZIP", value: billingZip },
        { label: "Network detected", value: network },
        { label: "Transport", value: "TLS 1.3 — card data encrypted in transit" },
      ],
      note: "Card data never touches the merchant server. Sent directly to payment processor via JavaScript SDK.",
    },
  });

  if (!inputValid) {
    return NextResponse.json({ txnId, stages, approved: false, reason: "Invalid card data" });
  }

  // ── Stage 2: Tokenization ────────────────────────────────────────────────
  await delay(500);

  stages.push({
    id: "tokenization",
    label: "Tokenization",
    status: "success",
    duration: 500,
    customer: "Securing your card details...",
    system: {
      title: "Network tokenization",
      fields: [
        { label: "PAN", value: `${pan.replace(/\s/g,"").slice(0,6)}******${pan.replace(/\s/g,"").slice(-4)}` },
        { label: "Token (PAN substitute)", value: token },
        { label: "Token type", value: "Network token (Visa Token Service / MDES)" },
        { label: "Token scope", value: "Merchant-bound — only usable at this merchant" },
        { label: "Cryptogram", value: uid() },
        { label: "Token requestor", value: merchantName },
        { label: "Stored as", value: "Token only — PAN never stored by merchant" },
      ],
      note: "PAN replaced with a network token. If the merchant database is breached, the token is useless elsewhere. Tokenization reduces PCI DSS scope.",
    },
  });

  // ── Stage 3: 3DS Challenge ───────────────────────────────────────────────
  await delay(1200);
  const requires3DS = amountCents > 5000 || Math.random() > 0.4;
  const threeDSPassed = requires3DS ? Math.random() > 0.05 : true;

  stages.push({
    id: "three_ds",
    label: "3-D Secure",
    status: requires3DS ? (threeDSPassed ? "success" : "failed") : "success",
    duration: 1200,
    customer: !requires3DS
      ? "Frictionless authentication — no action needed"
      : threeDSPassed
      ? "Identity verified via banking app"
      : "Authentication failed",
    system: {
      title: `3DS 2.x — ${requires3DS ? "Challenge flow" : "Frictionless flow"}`,
      fields: [
        { label: "3DS version", value: "2.2.0" },
        { label: "Flow", value: requires3DS ? "Challenge — OTP sent to cardholder" : "Frictionless — ACS approved silently" },
        { label: "ACS (issuer)", value: "Issuer Access Control Server" },
        { label: "DS (directory server)", value: network === "Visa" ? "Visa Directory Server" : "Mastercard DS" },
        { label: "Authentication value", value: requires3DS ? (threeDSPassed ? `CAVV: ${uid()}` : "Not issued — failed") : `CAVV: ${uid()} (frictionless)` },
        { label: "ECI", value: requires3DS ? (threeDSPassed ? "05 — fully authenticated" : "07 — attempt") : "06 — frictionless" },
        { label: "Liability shift", value: requires3DS && threeDSPassed ? "Shifted to issuer" : "Remains with merchant" },
        { label: "Result", value: threeDSPassed ? "Authenticated" : "Failed" },
      ],
      note: requires3DS && threeDSPassed
        ? "Liability shifted to issuer. If this transaction is later disputed as fraud, the issuer bears the loss."
        : !requires3DS
        ? "Frictionless — issuer approved without challenging the cardholder based on device/behavioral data."
        : "3DS failed. Transaction will be declined.",
    },
  });

  if (requires3DS && !threeDSPassed) {
    return NextResponse.json({ txnId, stages, approved: false, reason: "3DS authentication failed" });
  }

  // ── Stage 4: Authorization ───────────────────────────────────────────────
  await delay(700);
  const declined = Math.random() < 0.08;
  const declineCodes = [
    { code: "51", reason: "Insufficient funds" },
    { code: "05", reason: "Do not honor" },
    { code: "91", reason: "Issuer unavailable" },
  ];
  const declineInfo = declined ? declineCodes[Math.floor(Math.random() * declineCodes.length)] : null;
  const aCode = declined ? undefined : authCode();
  const interchange = Math.round(amountCents * (network === "Amex" ? 0.025 : 0.018));

  stages.push({
    id: "authorization",
    label: "Authorization",
    status: declined ? "failed" : "success",
    duration: 700,
    customer: declined
      ? `Payment declined — ${declineInfo!.reason}`
      : "Payment authorized!",
    system: {
      title: `ISO 8583 MTI 0100 / 0110 — ${declined ? "DECLINED" : "APPROVED"}`,
      fields: [
        { label: "MTI request", value: "0100 — Auth request" },
        { label: "DE 2  Token (PAN sub)", value: token.slice(0, 16) },
        { label: "DE 4  Amount", value: `$${(amountCents/100).toFixed(2)}` },
        { label: "DE 11 STAN", value: stanNum },
        { label: "DE 22 Entry mode", value: "010 — Card not present (e-commerce)" },
        { label: "MTI response", value: "0110 — Auth response" },
        { label: "DE 38 Auth code", value: aCode ?? "— (declined)" },
        { label: "DE 39 Response code", value: declined ? `${declineInfo!.code} — ${declineInfo!.reason}` : "00 — Approved" },
        { label: "Interchange", value: declined ? "N/A" : `-$${(interchange/100).toFixed(2)} (${network})` },
      ],
      note: declined
        ? `Transaction declined. DE 39 response code ${declineInfo!.code} returned.`
        : "Auth hold placed on cardholder account. Capture not yet submitted — money has not moved.",
    },
  });

  if (declined) {
    return NextResponse.json({ txnId, stages, approved: false, reason: declineInfo!.reason });
  }

  // ── Stage 5: Capture ─────────────────────────────────────────────────────
  await delay(400);
  const schemeFee = 4;
  const processingFee = Math.round(amountCents * 0.003);
  const netSettlement = amountCents - interchange - schemeFee - processingFee;

  stages.push({
    id: "capture",
    label: "Capture",
    status: "success",
    duration: 400,
    customer: `Order confirmed\nPayment received by ${merchantName}\nOrder will be processed`,
    system: {
      title: "Capture request + order confirmation",
      fields: [
        { label: "Transaction ID", value: txnId },
        { label: "Auth code", value: aCode! },
        { label: "Capture amount", value: `$${(amountCents/100).toFixed(2)}` },
        { label: "Capture timing", value: "Immediate (e-commerce standard)" },
        { label: "Gross amount", value: `$${(amountCents/100).toFixed(2)}` },
        { label: "Interchange", value: `-$${(interchange/100).toFixed(2)}` },
        { label: "Scheme fee", value: `-$${(schemeFee/100).toFixed(2)}` },
        { label: "Processing fee", value: `-$${(processingFee/100).toFixed(2)}` },
        { label: "Net to merchant", value: `$${(netSettlement/100).toFixed(2)}` },
        { label: "Settlement", value: "T+1 to T+2 via clearing batch" },
        { label: "Status", value: "CAPTURED — entering clearing" },
      ],
      note: "Capture submitted immediately on order confirmation. Will appear in next settlement batch. Cardholder statement will show merchant name.",
    },
  });

  txnLog.push({
    txnId, type: "ECOMMERCE", merchantName,
    amount: amountCents, network, authCode: aCode, token,
    status: "captured", createdAt: new Date().toISOString(),
  });

  return NextResponse.json({
    txnId, stages, approved: true, authCode: aCode,
    token, network, amount: amountCents,
    fees: { interchange, schemeFee, processingFee, netSettlement },
  });
}

export async function GET() {
  return NextResponse.json({ recentTransactions: txnLog.slice(-20) });
}
