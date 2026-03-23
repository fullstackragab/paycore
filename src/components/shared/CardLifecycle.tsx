"use client";

import { useState } from "react";
import clsx from "clsx";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Stage {
  id: string;
  label: string;
  sublabel: string;
  color: string;
  bgColor: string;
  borderColor: string;
  party: string;
  timing: string;
  description: string;
  technical: string[];
  failureModes: string[];
  moneyMoves: boolean;
  messageMoves: boolean;
  ledgerChanges: boolean;
}

interface Party {
  id: string;
  label: string;
  color: string;
  description: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const PARTIES: Party[] = [
  {
    id: "cardholder",
    label: "Cardholder",
    color: "bg-gray-50 text-gray-700 border-gray-200",
    description: "The customer initiating the payment using their card or digital wallet.",
  },
  {
    id: "merchant",
    label: "Merchant",
    color: "bg-gray-50 text-gray-700 border-gray-200",
    description: "The business accepting the payment. Receives net settlement after fees.",
  },
  {
    id: "gateway",
    label: "Payment Gateway",
    color: "bg-gray-50 text-gray-700 border-gray-200",
    description: "Encrypts and routes the transaction data from merchant to processor.",
  },
  {
    id: "processor",
    label: "Processor / Acquirer",
    color: "bg-gray-50 text-gray-700 border-gray-200",
    description: "Processes the transaction on behalf of the merchant. Manages clearing and settlement.",
  },
  {
    id: "network",
    label: "Card Network",
    color: "bg-gray-50 text-gray-700 border-gray-200",
    description: "Visa / Mastercard / Amex. Routes auth requests, sets interchange rates, governs dispute rules.",
  },
  {
    id: "issuer",
    label: "Issuing Bank",
    color: "bg-gray-50 text-gray-700 border-gray-200",
    description: "The cardholder's bank. Approves or declines the auth request, holds the cardholder's funds.",
  },
];

const STAGES: Stage[] = [
  {
    id: "initiation",
    label: "1. Initiation",
    sublabel: "Tap, swipe, or click",
    color: "text-slate-700",
    bgColor: "bg-slate-50",
    borderColor: "border-slate-300",
    party: "cardholder",
    timing: "Instant",
    description:
      "The cardholder initiates a payment by tapping a card, inserting a chip, or entering card details online. The PAN (Primary Account Number) is read, and for card-not-present transactions a CVV and billing address are collected.",
    technical: [
      "PAN read from magnetic stripe, chip (EMV), or NFC",
      "For CNP: PAN + expiry + CVV + billing ZIP collected",
      "Tokenization may replace PAN with a network token",
      "3-D Secure challenge may be triggered before auth",
    ],
    failureModes: [
      "Card chip read failure → fallback to swipe",
      "NFC timeout → retry or insert",
      "Tokenization service unavailable",
    ],
    moneyMoves: false,
    messageMoves: true,
    ledgerChanges: false,
  },
  {
    id: "authorization",
    label: "2. Authorization",
    sublabel: "Approval request & response",
    color: "text-gray-700",
    bgColor: "bg-gray-50",
    borderColor: "border-gray-300",
    party: "issuer",
    timing: "1–3 seconds",
    description:
      "The payment gateway sends an ISO 8583 authorization request through the card network to the issuing bank. The issuer checks available balance, fraud rules, and card status, then returns an approval code or decline reason. No money moves yet — this is a hold.",
    technical: [
      "ISO 8583 message sent: MTI 0100 (auth request)",
      "Card network routes to correct issuer via BIN lookup",
      "Issuer checks: balance, fraud score, velocity, card status",
      "Response: approval code (6 chars) or decline code",
      "Auth hold placed on cardholder account",
      "Response time SLA: < 3 seconds",
    ],
    failureModes: [
      "Issuer timeout → gateway returns 'issuer unavailable'",
      "Duplicate auth → idempotency key prevents double-hold",
      "Partial approval → issuer approves lower amount",
      "Ghost authorization → hold never released",
    ],
    moneyMoves: false,
    messageMoves: true,
    ledgerChanges: true,
  },
  {
    id: "capture",
    label: "3. Capture",
    sublabel: "Merchant confirms amount",
    color: "text-gray-700",
    bgColor: "bg-gray-50",
    borderColor: "border-gray-300",
    party: "merchant",
    timing: "Seconds to hours",
    description:
      "After authorization, the merchant submits a capture request to finalize the exact amount. For most retail transactions capture happens immediately. For hotels, car rentals, or restaurants a tip is added before capture. An uncaptured auth expires in 7–30 days depending on the network.",
    technical: [
      "MTI 0200 (financial transaction) or 0220 (capture)",
      "Captured amount may differ from authorized amount (e.g. tip)",
      "Over-capture not allowed — must be ≤ authorized amount",
      "Uncaptured auths expire: Visa 7 days, Mastercard 30 days",
      "Pre-auth capture common for hospitality and travel",
    ],
    failureModes: [
      "Late capture after auth expiry → transaction fails",
      "Over-capture → issuer rejects",
      "Capture without prior auth → processor rejects",
      "Partial capture → remainder of hold released by issuer",
    ],
    moneyMoves: false,
    messageMoves: true,
    ledgerChanges: true,
  },
  {
    id: "clearing",
    label: "4. Clearing",
    sublabel: "Transaction submitted to network",
    color: "text-gray-700",
    bgColor: "bg-gray-50",
    borderColor: "border-gray-300",
    party: "network",
    timing: "Same day, batch",
    description:
      "At end of day the acquirer submits a clearing file containing all captured transactions to the card network. The network routes each transaction to the correct issuer. This is the process of exchanging transaction data — money has not moved yet.",
    technical: [
      "Clearing file format: Visa BASE II, Mastercard IPM",
      "Batch submitted at acquirer cut-off time (typically EOD)",
      "Network calculates interchange for each transaction",
      "Interchange rate based on: card type, MCC, card-present flag",
      "Net settlement position calculated per institution",
    ],
    failureModes: [
      "Late presentment (> 30 days) → chargeback risk increases",
      "Mismatched amounts between auth and clearing",
      "Missing data fields → transaction rejected by network",
      "Cut-off time missed → next business day batch",
    ],
    moneyMoves: false,
    messageMoves: true,
    ledgerChanges: false,
  },
  {
    id: "settlement",
    label: "5. Settlement",
    sublabel: "Funds actually move",
    color: "text-green-700",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    party: "processor",
    timing: "T+1 to T+3",
    description:
      "The card network nets all positions and instructs banks to move funds. The issuer debits the cardholder, the acquirer credits the merchant (minus interchange and fees). This is when money actually moves between financial institutions via the central bank settlement system.",
    technical: [
      "Net settlement: card network nets all clearing positions",
      "Funds move via central bank (Fedwire, CHAPS, TARGET2)",
      "Acquirer receives gross amount minus interchange",
      "Merchant funded: gross amount minus MDR (merchant discount rate)",
      "MDR = interchange + scheme fee + acquirer margin",
      "Settlement account: acquirer holds funds until merchant payout",
    ],
    failureModes: [
      "Settlement failure → funds held, ops team investigation",
      "Mismatched settlement file → reconciliation break",
      "Prefunding shortfall → acquirer may delay merchant payout",
      "FX settlement risk for cross-border transactions",
    ],
    moneyMoves: true,
    messageMoves: false,
    ledgerChanges: true,
  },
  {
    id: "reconciliation",
    label: "6. Reconciliation",
    sublabel: "Verify every cent matches",
    color: "text-gray-700",
    bgColor: "bg-gray-50",
    borderColor: "border-gray-300",
    party: "processor",
    timing: "Daily, T+1",
    description:
      "The payment processor and merchant compare their internal ledgers against the bank statement and settlement files. Every transaction must match: amount, currency, timestamp, reference number. Breaks are investigated — they can indicate fraud, system bugs, or timing differences.",
    technical: [
      "Compare: internal ledger vs processor settlement file vs bank statement",
      "Match on: amount, currency, RRN, auth code, merchant ID",
      "Exception types: unmatched, mismatched amount, duplicate, timing",
      "Reconciliation run after settlement file received",
      "Breaks escalated to ops team for manual investigation",
    ],
    failureModes: [
      "Ledger drift — internal system out of sync with bank",
      "Duplicate posting — transaction recorded twice",
      "Timing difference — transaction in different settlement windows",
      "Currency conversion mismatch for FX transactions",
    ],
    moneyMoves: false,
    messageMoves: false,
    ledgerChanges: true,
  },
  {
    id: "chargeback",
    label: "7. Chargeback",
    sublabel: "Dispute flow (failure path)",
    color: "text-rose-700",
    bgColor: "bg-rose-50",
    borderColor: "border-rose-200",
    party: "issuer",
    timing: "Up to 120 days",
    description:
      "The cardholder disputes the transaction with their bank. The issuer initiates a chargeback, reversing the funds and debiting the acquirer. The merchant must submit evidence within a deadline (typically 20–30 days) or lose the funds permanently. Fraud chargebacks are the most common and most costly.",
    technical: [
      "Chargeback reason codes: Visa (10.x, 12.x, 13.x), MC (4xxx)",
      "Representment: merchant submits evidence to fight chargeback",
      "Second chargeback (pre-arbitration): issuer rejects representment",
      "Arbitration: card network makes final binding decision",
      "Chargeback fee: $15–$100 per case regardless of outcome",
      "Excessive chargebacks (> 1%): fines, program monitoring, termination",
    ],
    failureModes: [
      "Evidence not submitted in time → automatic loss",
      "Insufficient evidence → representment rejected",
      "Friendly fraud → difficult to prove goods delivered",
      "Arbitration loss → additional fees on top of transaction amount",
    ],
    moneyMoves: true,
    messageMoves: true,
    ledgerChanges: true,
  },
];

const PARTY_LABELS: Record<string, string> = {
  cardholder: "Cardholder",
  merchant:   "Merchant",
  gateway:    "Gateway",
  processor:  "Processor / Acquirer",
  network:    "Card Network",
  issuer:     "Issuing Bank",
};

const PARTY_COLORS: Record<string, string> = {
  cardholder: "bg-gray-50 text-gray-700 border-gray-200",
  merchant:   "bg-gray-50 text-gray-700 border-gray-200",
  gateway:    "bg-gray-50 text-gray-700 border-gray-200",
  processor:  "bg-gray-50 text-gray-700 border-gray-200",
  network:    "bg-gray-50 text-gray-700 border-gray-200",
  issuer:     "bg-gray-50 text-gray-700 border-gray-200",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function CardLifecycle() {
  const [selected, setSelected] = useState<Stage>(STAGES[0]);
  const [showParties, setShowParties] = useState(false);

  return (
    <div className="space-y-6">
      {/* Explainer */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Card payment lifecycle — from tap to merchant payout
            </h3>
            <p className="mt-1 text-xs text-slate-500 max-w-2xl">
              Every card payment passes through up to seven stages involving six
              distinct parties. Click each stage to see exactly what happens, which
              systems are involved, and what can go wrong.
            </p>
          </div>
          <button
            onClick={() => setShowParties((v) => !v)}
            className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            {showParties ? "Hide" : "Show"} parties
          </button>
        </div>

        {/* Parties row */}
        {showParties && (
          <div className="mt-4 grid grid-cols-3 gap-3">
            {PARTIES.map((p) => (
              <div key={p.id} className={clsx("rounded-lg border p-3", PARTY_COLORS[p.id])}>
                <p className="text-xs font-semibold">{p.label}</p>
                <p className="mt-0.5 text-xs opacity-75 leading-relaxed">{p.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stage pipeline */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-0 overflow-x-auto pb-2">
          {STAGES.map((stage, i) => (
            <div key={stage.id} className="flex items-center shrink-0">
              <button
                onClick={() => setSelected(stage)}
                className={clsx(
                  "rounded-lg border-2 px-3 py-2.5 text-left transition-all min-w-[110px]",
                  selected.id === stage.id
                    ? `${stage.bgColor} ${stage.borderColor} shadow-sm`
                    : "bg-white border-slate-200 hover:border-slate-300"
                )}
              >
                <p className={clsx("text-xs font-semibold leading-tight", selected.id === stage.id ? stage.color : "text-slate-700")}>
                  {stage.label}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{stage.sublabel}</p>
              </button>
              {i < STAGES.length - 1 && (
                <div className="flex items-center mx-1 shrink-0">
                  {i === 5 ? (
                    // Chargeback is a branch, show dashed
                    <svg width="20" height="20" viewBox="0 0 20 20">
                      <path d="M2 10 L18 10" stroke="#e2e8f0" strokeWidth="1.5" strokeDasharray="3 2" fill="none"/>
                      <path d="M13 6 L18 10 L13 14" stroke="#e2e8f0" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 20 20">
                      <path d="M2 10 L18 10" stroke="#cbd5e1" strokeWidth="1.5" fill="none"/>
                      <path d="M13 6 L18 10 L13 14" stroke="#cbd5e1" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Stage detail */}
      <div className="grid grid-cols-3 gap-4">
        {/* Main detail */}
        <div className={clsx("col-span-2 rounded-xl border-2 p-5 shadow-sm", selected.bgColor, selected.borderColor)}>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h3 className={clsx("text-base font-semibold", selected.color)}>{selected.label}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{selected.sublabel}</p>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <span className={clsx("rounded-full border px-2.5 py-1 text-xs font-medium", PARTY_COLORS[selected.party])}>
                {PARTY_LABELS[selected.party]}
              </span>
              <span className="text-xs text-slate-400"> {selected.timing}</span>
            </div>
          </div>

          <p className="text-sm text-slate-700 leading-relaxed mb-5">{selected.description}</p>

          {/* Money / message / ledger indicators */}
          <div className="flex gap-3 mb-5">
            {[
              { key: "moneyMoves",   label: "Money moves",   icon: "$" },
              { key: "messageMoves", label: "Message moves",  icon: "MSG" },
              { key: "ledgerChanges",label: "Ledger changes", icon: "LED" },
            ].map(({ key, label, icon }) => {
              const active = selected[key as keyof Stage] as boolean;
              return (
                <div
                  key={key}
                  className={clsx(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border",
                    active
                      ? "bg-white border-gray-300 text-gray-700"
                      : "bg-gray-50 border-gray-200 text-gray-300"
                  )}
                >
                  <span>{icon}</span>
                  <span>{label}</span>
                  <span className={active ? "text-green-600" : "text-slate-200"}>
                    {active ? "yes" : "no"}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Technical detail */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                Technical detail
              </p>
              <ul className="space-y-1.5">
                {selected.technical.map((t) => (
                  <li key={t} className="flex items-start gap-2 text-xs text-slate-600">
                    <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            {/* Failure modes */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-500 mb-2">
                Failure modes
              </p>
              <ul className="space-y-1.5">
                {selected.failureModes.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-slate-600">
                    <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-rose-400 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Stage navigator */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
            All stages
          </p>
          <div className="space-y-1">
            {STAGES.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelected(s)}
                className={clsx(
                  "w-full rounded-lg px-3 py-2.5 text-left transition-colors",
                  selected.id === s.id
                    ? `${s.bgColor} ${s.color}`
                    : "hover:bg-slate-50 text-slate-600"
                )}
              >
                <p className="text-xs font-semibold">{s.label}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{s.timing}</p>
              </button>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Stages 1–6 are the normal path. Stage 7 (chargeback) is the dispute path triggered
              when a cardholder contests a settled transaction.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
