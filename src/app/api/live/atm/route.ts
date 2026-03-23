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
  const { pan, pin, expiry, amount, atmLocation, atmId } = body;

  const amountCents = Math.round(parseFloat(amount) * 100);
  const network = detectNetwork(pan);
  const stanNum = stan();
  const txnId = `ATM-${uid()}`;
  const stages = [];

  // ── Stage 1: Card inserted ───────────────────────────────────────────────
  await delay(600);
  const panValid = luhnCheck(pan.replace(/\s/g, ""));
  const [mm, yy] = expiry.split("/");
  const expiryValid = new Date(2000 + Number(yy), Number(mm) - 1) >= new Date();

  stages.push({
    id: "card_inserted",
    label: "Card inserted",
    status: panValid && expiryValid ? "success" : "failed",
    duration: 600,
    customer: !panValid
      ? "Card read error — please try again"
      : !expiryValid
      ? "Card expired — please use a valid card"
      : `Card read\n●●●● ●●●● ●●●● ${pan.replace(/\s/g,"").slice(-4)}\nPlease enter PIN`,
    system: {
      title: "ATM card reader",
      fields: [
        { label: "ATM ID", value: atmId || "ATM-0042" },
        { label: "Location", value: atmLocation || "Unknown" },
        { label: "Read method", value: "EMV Chip" },
        { label: "PAN (masked)", value: `●●●● ●●●● ●●●● ${pan.replace(/\s/g,"").slice(-4)}` },
        { label: "Luhn check", value: panValid ? "✓ Pass" : "✗ Fail" },
        { label: "Expiry check", value: expiryValid ? "✓ Valid" : "✗ Expired" },
        { label: "Network", value: network },
        { label: "Processing code", value: "011000 — Cash withdrawal" },
      ],
      note: "Chip data read. ATM sends ISO 8583 auth request with processing code 011000 (cash withdrawal) to acquirer.",
    },
  });

  if (!panValid || !expiryValid) {
    return NextResponse.json({ txnId, stages, approved: false, reason: !panValid ? "Card read error" : "Expired card" });
  }

  // ── Stage 2: PIN verification ────────────────────────────────────────────
  await delay(800);
  const pinValid = pin.length === 4 && /^\d{4}$/.test(pin);
  const pinCorrect = pinValid && Math.random() > 0.05;

  stages.push({
    id: "pin_verify",
    label: "PIN verify",
    status: pinCorrect ? "success" : "failed",
    duration: 800,
    customer: !pinValid
      ? "Invalid PIN format"
      : pinCorrect
      ? "PIN verified"
      : "Incorrect PIN — please try again",
    system: {
      title: "PIN verification — encrypted",
      fields: [
        { label: "PIN entry", value: "●●●●" },
        { label: "PIN format", value: pinValid ? "✓ 4 digits" : "✗ Invalid" },
        { label: "Encryption", value: "PIN Block — ISO 9564 Format 0" },
        { label: "Key type", value: "Triple DES (3DES) under HSM" },
        { label: "Verification", value: pinCorrect ? "✓ Online PIN — sent to issuer for verification" : "✗ PIN mismatch — issuer declined" },
        { label: "Attempt count", value: "1 of 3 — card blocked after 3 failures" },
        { label: "Result", value: pinCorrect ? "VERIFIED" : "FAILED" },
      ],
      note: pinCorrect
        ? "PIN encrypted in Hardware Security Module (HSM). Sent to issuer as PIN block. PIN never transmitted in clear text."
        : "PIN verification failed. Issuer returned decline. 2 attempts remaining before card block.",
    },
  });

  if (!pinCorrect) {
    return NextResponse.json({ txnId, stages, approved: false, reason: "Incorrect PIN" });
  }

  // ── Stage 3: Balance check ───────────────────────────────────────────────
  await delay(700);
  const simulatedBalance = Math.round((Math.random() * 500 + 200) * 100);
  const hasBalance = simulatedBalance >= amountCents;
  const atmFee = Math.round(250);

  stages.push({
    id: "balance_check",
    label: "Balance check",
    status: hasBalance ? "success" : "failed",
    duration: 700,
    customer: hasBalance
      ? `Balance confirmed\nWithdrawing $${(amountCents/100).toFixed(2)}...`
      : `Insufficient funds\nRequested: $${(amountCents/100).toFixed(2)}\nAvailable: $${(simulatedBalance/100).toFixed(2)}`,
    system: {
      title: "Issuer balance check",
      fields: [
        { label: "MTI", value: "0100 — Auth request (cash)" },
        { label: "DE 3  Processing code", value: "011000 — Cash withdrawal" },
        { label: "DE 4  Amount", value: `$${(amountCents/100).toFixed(2)}` },
        { label: "DE 18 MCC", value: "6011 — ATM cash disbursement" },
        { label: "Available balance", value: `$${(simulatedBalance/100).toFixed(2)}` },
        { label: "Requested", value: `$${(amountCents/100).toFixed(2)}` },
        { label: "ATM fee", value: `$${(atmFee/100).toFixed(2)} (foreign ATM surcharge)` },
        { label: "Total debit", value: `$${((amountCents + atmFee)/100).toFixed(2)}` },
        { label: "Decision", value: hasBalance ? "APPROVE" : "DECLINE — insufficient funds" },
      ],
      note: hasBalance
        ? "Balance check passed. Issuer approved withdrawal + ATM surcharge. Auth hold placed."
        : `Available balance ($${(simulatedBalance/100).toFixed(2)}) insufficient for requested amount + fee.`,
    },
  });

  if (!hasBalance) {
    return NextResponse.json({ txnId, stages, approved: false, reason: "Insufficient funds" });
  }

  // ── Stage 4: Auth hold ───────────────────────────────────────────────────
  await delay(400);
  const aCode = authCode();

  stages.push({
    id: "auth_hold",
    label: "Auth hold",
    status: "success",
    duration: 400,
    customer: "Dispensing cash...",
    system: {
      title: "ISO 8583 MTI 0110 — Auth approved",
      fields: [
        { label: "MTI response", value: "0110 — Approved" },
        { label: "DE 38 Auth code", value: aCode },
        { label: "DE 39 Response code", value: "00 — Approved" },
        { label: "STAN", value: stanNum },
        { label: "Hold amount", value: `$${((amountCents + atmFee)/100).toFixed(2)}` },
        { label: "Hold type", value: "Debit — immediate (debit card)" },
        { label: "Cardholder balance (after hold)", value: `$${((simulatedBalance - amountCents - atmFee)/100).toFixed(2)}` },
      ],
      note: "For debit cards, the hold is immediately reflected in available balance. For credit cards, the hold reduces available credit.",
    },
  });

  // ── Stage 5: Cash dispensed + ledger ────────────────────────────────────
  await delay(500);

  stages.push({
    id: "cash_dispensed",
    label: "Cash dispensed",
    status: "success",
    duration: 500,
    customer: `✓ Please take your cash\n$${(amountCents/100).toFixed(2)} dispensed\nATM fee: $${(atmFee/100).toFixed(2)}\nAuth code: ${aCode}`,
    system: {
      title: "Cash dispensed + ledger entries",
      fields: [
        { label: "Transaction ID", value: txnId },
        { label: "Auth code", value: aCode },
        { label: "Cash dispensed", value: `$${(amountCents/100).toFixed(2)}` },
        { label: "ATM surcharge", value: `$${(atmFee/100).toFixed(2)}` },
        { label: "Total debited", value: `$${((amountCents + atmFee)/100).toFixed(2)}` },
        { label: "Issuer ledger", value: "DEBIT posted to cardholder account" },
        { label: "Acquirer (ATM operator)", value: "CREDIT posted (cash + surcharge)" },
        { label: "Interchange", value: "Paid by issuer to ATM operator ($0.50 typical)" },
        { label: "Settlement", value: "T+0 to T+1 (ATM transactions settle faster)" },
        { label: "Status", value: "COMPLETE" },
      ],
      note: "Cash physically dispensed. Ledger entries posted. ATM operator receives interchange from issuer for providing cash access. Receipt printed.",
    },
  });

  txnLog.push({
    txnId, type: "ATM", location: atmLocation,
    amount: amountCents, atmFee, network, authCode: aCode,
    status: "complete", createdAt: new Date().toISOString(),
  });

  return NextResponse.json({
    txnId, stages, approved: true,
    authCode: aCode, amount: amountCents,
    atmFee, totalDebited: amountCents + atmFee,
  });
}

export async function GET() {
  return NextResponse.json({ recentTransactions: txnLog.slice(-20) });
}
