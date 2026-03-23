import { NextRequest, NextResponse } from "next/server";

const txnLog: unknown[] = [];

function uid() { return Math.random().toString(36).slice(2, 10).toUpperCase(); }
function uetr() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}
function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

const FX_RATES: Record<string, number> = {
  "USD/EUR": 0.9215, "USD/GBP": 0.7892, "USD/EGP": 49.25,
  "USD/AED": 3.6725, "USD/INR": 83.42,  "USD/JPY": 149.85,
  "USD/NGN": 1580.0, "USD/BRL": 5.12,   "USD/MXN": 17.23,
  "EUR/USD": 1.085,  "GBP/USD": 1.267,
};

const SANCTIONS_NAMES = ["AL-RASHID ARMS", "PHANTOM TRADING CO", "SHADOW FINANCE LTD"];
const HIGH_RISK_COUNTRIES = ["IR", "KP", "SY", "RU", "BY"];

const CORRESPONDENTS: Record<string, string[]> = {
  EG: ["JPMorgan Chase (New York)", "CIB Egypt (Cairo)"],
  IN: ["Citibank (New York)", "HDFC Bank (Mumbai)"],
  AE: ["HSBC (Dubai)", "Emirates NBD (Dubai)"],
  NG: ["Standard Chartered (Lagos)", "Zenith Bank (Lagos)"],
  DEFAULT: ["Deutsche Bank (Frankfurt)"],
};

function getFXRate(from: string, to: string): number {
  if (from === to) return 1;
  return FX_RATES[`${from}/${to}`] ?? 1 / (FX_RATES[`${to}/${from}`] ?? 1);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    senderName, senderIBAN, senderBank,
    receiverName, receiverIBAN, receiverBank, receiverCountry,
    amount, sendCurrency, receiveCurrency, purposeCode, reference,
  } = body;

  const amountCents = Math.round(parseFloat(amount) * 100);
  const txnId = `XB-${uid()}`;
  const uetrId = uetr();
  const endToEndRef = `E2E-${uid()}`;
  const stages = [];

  // ── Stage 1: Initiation ──────────────────────────────────────────────────
  await delay(500);
  stages.push({
    id: "initiation",
    label: "Initiation",
    status: "success",
    duration: 500,
    customer: `Transfer initiated\n${senderName} → ${receiverName}\n${sendCurrency} ${(amountCents/100).toFixed(2)}`,
    system: {
      title: "Payment instruction created",
      fields: [
        { label: "Transaction ID", value: txnId },
        { label: "UETR (GPI)", value: uetrId },
        { label: "End-to-end ref", value: endToEndRef },
        { label: "Sender", value: `${senderName} / ${senderBank}` },
        { label: "Sender IBAN", value: senderIBAN },
        { label: "Receiver", value: `${receiverName} / ${receiverBank}` },
        { label: "Receiver IBAN", value: receiverIBAN },
        { label: "Amount", value: `${sendCurrency} ${(amountCents/100).toFixed(2)}` },
        { label: "Purpose code", value: `${purposeCode} — ${purposeCode === "SALA" ? "Salary" : purposeCode === "SUPP" ? "Supplier payment" : purposeCode === "TRAD" ? "Trade" : "Transfer"}` },
        { label: "Reference", value: reference || "—" },
      ],
      note: "SWIFT GPI UETR assigned. Payment instruction validated and queued for compliance screening.",
    },
  });

  // ── Stage 2: KYC / Sanctions ─────────────────────────────────────────────
  await delay(900);
  const isSanctioned = SANCTIONS_NAMES.some(n =>
    receiverName.toUpperCase().includes(n.split(" ")[0])
  );
  const isHighRisk = HIGH_RISK_COUNTRIES.includes(receiverCountry);

  if (isSanctioned) {
    stages.push({
      id: "kyc_sanctions",
      label: "KYC / Sanctions",
      status: "failed",
      duration: 900,
      customer: "Transfer blocked — compliance hold",
      system: {
        title: "Sanctions screening — BLOCKED",
        fields: [
          { label: "OFAC SDN check", value: "⚠ Possible match" },
          { label: "EU list check", value: "⚠ Possible match" },
          { label: "UN list check", value: "Screening..." },
          { label: "Receiver name", value: receiverName },
          { label: "Action", value: "HOLD — escalated to compliance team" },
          { label: "SAR required", value: "Pending review" },
        ],
        note: "Payment frozen. Tipping off the customer is prohibited under AML regulations. Compliance team notified.",
      },
    });
    return NextResponse.json({ txnId, stages, approved: false, blocked: true, reason: "Sanctions hold" });
  }

  stages.push({
    id: "kyc_sanctions",
    label: "KYC / Sanctions",
    status: isHighRisk ? "warning" : "success",
    duration: 900,
    customer: isHighRisk ? "Enhanced verification required..." : "Identity verified",
    system: {
      title: `Sanctions screening — ${isHighRisk ? "HIGH RISK CORRIDOR" : "CLEAR"}`,
      fields: [
        { label: "OFAC SDN check", value: "✓ No match" },
        { label: "EU consolidated list", value: "✓ No match" },
        { label: "UN Security Council", value: "✓ No match" },
        { label: "HM Treasury list", value: "✓ No match" },
        { label: "PEP screening", value: "✓ Not a PEP" },
        { label: "Receiver country", value: `${receiverCountry} — ${isHighRisk ? "⚠ Enhanced due diligence required" : "Standard risk"}` },
        { label: "AML check", value: "✓ No suspicious patterns" },
        { label: "Decision", value: isHighRisk ? "PROCEED WITH EDD" : "CLEAR — proceed" },
      ],
      note: isHighRisk
        ? "High-risk corridor. Enhanced due diligence applied. Additional documentation may be required."
        : "All sanctions lists cleared. Payment approved for FX conversion.",
    },
  });

  // ── Stage 3: FX Conversion ───────────────────────────────────────────────
  await delay(600);
  const fxRate = getFXRate(sendCurrency, receiveCurrency);
  const fxVariance = 1 + (Math.random() - 0.5) * 0.002;
  const effectiveRate = fxRate * fxVariance;
  const fxFee = Math.round(amountCents * 0.0025);
  const liftingFees = Math.round(2500 + Math.random() * 1000);
  const ourFee = Math.round(500 + Math.random() * 500);
  const receiveAmountCents = Math.round((amountCents - fxFee - liftingFees - ourFee) * effectiveRate);
  const isSameCurrency = sendCurrency === receiveCurrency;

  stages.push({
    id: "fx_conversion",
    label: "FX conversion",
    status: "success",
    duration: 600,
    customer: isSameCurrency
      ? `No FX needed — same currency`
      : `Converting ${sendCurrency} → ${receiveCurrency}\nRate: ${effectiveRate.toFixed(4)}`,
    system: {
      title: isSameCurrency ? "FX — same currency, no conversion" : `FX — Spot conversion ${sendCurrency}/${receiveCurrency}`,
      fields: [
        { label: "Send amount", value: `${sendCurrency} ${(amountCents/100).toFixed(2)}` },
        { label: "Mid-market rate", value: `1 ${sendCurrency} = ${fxRate.toFixed(4)} ${receiveCurrency}` },
        { label: "Bank rate (spread)", value: `1 ${sendCurrency} = ${effectiveRate.toFixed(4)} ${receiveCurrency}` },
        { label: "FX spread (0.25%)", value: `-${sendCurrency} ${(fxFee/100).toFixed(2)}` },
        { label: "Lifting fees", value: `-${sendCurrency} ${(liftingFees/100).toFixed(2)}` },
        { label: "Our fee", value: `-${sendCurrency} ${(ourFee/100).toFixed(2)}` },
        { label: "Conversion type", value: "Spot — same day" },
        { label: "Nostro account", value: `NOSTRO-${sendCurrency}-0012` },
        { label: "Receive amount", value: `${receiveCurrency} ${(receiveAmountCents/100).toFixed(2)}` },
      ],
      note: "Spot rate applied. Nostro account debited. Funds earmarked for outgoing SWIFT message.",
    },
  });

  // ── Stage 4: SWIFT MT103 ─────────────────────────────────────────────────
  await delay(700);
  const valueDate = new Date();
  valueDate.setDate(valueDate.getDate() + 1);
  const valueDateStr = valueDate.toISOString().slice(0, 10).replace(/-/g, "");

  stages.push({
    id: "swift_mt103",
    label: "SWIFT MT103",
    status: "success",
    duration: 700,
    customer: "Transfer sent to international network",
    system: {
      title: "SWIFT MT103 — Single Customer Credit Transfer",
      fields: [
        { label: ":20:  Reference", value: endToEndRef },
        { label: ":23B: Bank op code", value: "CRED" },
        { label: ":32A: Value date/amt", value: `${valueDateStr}${sendCurrency}${(amountCents/100).toFixed(2).replace(".", ",")}` },
        { label: ":50K: Ordering customer", value: `/${senderIBAN}\n${senderName.toUpperCase()}` },
        { label: ":52A: Ordering bank", value: senderBank.toUpperCase() },
        { label: ":56A: Intermediary", value: CORRESPONDENTS[receiverCountry]?.[0] ?? CORRESPONDENTS.DEFAULT[0] },
        { label: ":57A: Receiver bank", value: receiverBank.toUpperCase() },
        { label: ":59:  Beneficiary", value: `/${receiverIBAN}\n${receiverName.toUpperCase()}` },
        { label: ":70:  Remittance", value: reference || purposeCode },
        { label: ":71A: Charges", value: "SHA — shared charges" },
      ],
      note: `MT103 transmitted via SWIFT network. UETR: ${uetrId.slice(0, 18)}... GPI tracking enabled.`,
    },
  });

  // ── Stage 5: Correspondent routing ──────────────────────────────────────
  await delay(1000);
  const correspondents = CORRESPONDENTS[receiverCountry] ?? CORRESPONDENTS.DEFAULT;

  stages.push({
    id: "correspondent",
    label: "Correspondent routing",
    status: "success",
    duration: 1000,
    customer: "Routing through international banking network...",
    system: {
      title: "Correspondent bank chain",
      fields: [
        { label: "Step 1", value: `${senderBank} → ${correspondents[0]}` },
        { label: "Step 2", value: correspondents[1] ? `${correspondents[0]} → ${correspondents[1]}` : "Direct to receiver bank" },
        { label: "Step 3", value: correspondents[1] ? `${correspondents[1]} → ${receiverBank}` : `${correspondents[0]} → ${receiverBank}` },
        { label: "Lifting fee", value: `-${sendCurrency} ${(liftingFees/100).toFixed(2)} per hop` },
        { label: "Cover method", value: "MT103 + MT202COV (parallel)" },
        { label: "SWIFT GPI status", value: "In transit — tracking via UETR" },
        { label: "Est. arrival", value: `T+1 (${new Date(Date.now() + 86400000).toLocaleDateString()})` },
      ],
      note: "Cover method sends MT103 and MT202 simultaneously — faster than sequential method. Each correspondent debits/credits their nostro accounts.",
    },
  });

  // ── Stage 6: Final credit ────────────────────────────────────────────────
  await delay(500);

  stages.push({
    id: "credit",
    label: "Credited",
    status: "success",
    duration: 500,
    customer: `✓ Transfer complete\n${receiverName} will receive\n${receiveCurrency} ${(receiveAmountCents/100).toFixed(2)}`,
    system: {
      title: "Beneficiary account credited",
      fields: [
        { label: "Transaction ID", value: txnId },
        { label: "UETR", value: uetrId },
        { label: "Sender paid", value: `${sendCurrency} ${(amountCents/100).toFixed(2)}` },
        { label: "Receiver gets", value: `${receiveCurrency} ${(receiveAmountCents/100).toFixed(2)}` },
        { label: "Total fees", value: `${sendCurrency} ${((fxFee + liftingFees + ourFee)/100).toFixed(2)}` },
        { label: "Value date", value: valueDateStr },
        { label: "Receiver bank ledger", value: "CREDIT posted" },
        { label: "GPI status", value: "ACCC — Accepted, settlement completed" },
        { label: "Charges instruction", value: "SHA — receiver bank may deduct local fees" },
      ],
      note: "Payment complete. SWIFT GPI status updated to ACCC. Funds available subject to receiver bank value dating policy.",
    },
  });

  txnLog.push({
    txnId, type: "TRANSFER", senderName, receiverName,
    amount: amountCents, sendCurrency, receiveCurrency,
    receiveAmount: receiveAmountCents, uetr: uetrId,
    status: "credited", createdAt: new Date().toISOString(),
  });

  return NextResponse.json({
    txnId, stages, approved: true,
    uetr: uetrId, endToEndRef,
    sendAmount: amountCents, receiveAmount: receiveAmountCents,
    sendCurrency, receiveCurrency, fxRate: effectiveRate,
    fees: { fxFee, liftingFees, ourFee },
  });
}

export async function GET() {
  return NextResponse.json({ recentTransactions: txnLog.slice(-20) });
}
