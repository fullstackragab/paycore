import { CardTransactionStatus, ChargebackStatus, SettlementStatus, DeclineReason } from "@/types/payments";

// ─── Currency ─────────────────────────────────────────────────────────────────

export function formatCents(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export function formatCentsCompact(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 1_000)     return `$${(dollars / 1_000).toFixed(1)}K`;
  return formatCents(cents);
}

// ─── Percentages ──────────────────────────────────────────────────────────────

export function formatPercent(rate: number, decimals = 1): string {
  return `${(rate * 100).toFixed(decimals)}%`;
}

// ─── Dates ────────────────────────────────────────────────────────────────────

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day:   "numeric",
    hour:  "2-digit",
    minute:"2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day:   "numeric",
    year:  "numeric",
  }).format(new Date(iso));
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)  return "just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// ─── Status labels ────────────────────────────────────────────────────────────

export const CARD_STATUS_LABEL: Record<CardTransactionStatus, string> = {
  pending:    "Pending",
  authorized: "Authorized",
  captured:   "Captured",
  clearing:   "Clearing",
  settled:    "Settled",
  declined:   "Declined",
  reversed:   "Reversed",
  chargeback: "Chargeback",
  refunded:   "Refunded",
};

export const CHARGEBACK_STATUS_LABEL: Record<ChargebackStatus, string> = {
  received:           "Received",
  under_review:       "Under Review",
  evidence_submitted: "Evidence Submitted",
  won:                "Won",
  lost:               "Lost",
};

export const SETTLEMENT_STATUS_LABEL: Record<SettlementStatus, string> = {
  pending:    "Pending",
  processing: "Processing",
  complete:   "Complete",
  failed:     "Failed",
};

export const DECLINE_REASON_LABEL: Record<DeclineReason, string> = {
  insufficient_funds:  "Insufficient funds",
  card_expired:        "Card expired",
  fraud_suspected:     "Fraud suspected",
  issuer_unavailable:  "Issuer unavailable",
  do_not_honor:        "Do not honor",
  invalid_cvv:         "Invalid CVV",
  velocity_exceeded:   "Velocity exceeded",
  restricted_card:     "Restricted card",
};

// ─── Network display ──────────────────────────────────────────────────────────

export const NETWORK_LABEL: Record<string, string> = {
  visa:       "Visa",
  mastercard: "Mastercard",
  amex:       "Amex",
  discover:   "Discover",
};

// ─── Bank transfer labels ─────────────────────────────────────────────────────

export const BANK_STATUS_LABEL: Record<string, string> = {
  initiated:          "Initiated",
  submitted:          "Submitted",
  pending_settlement: "Pending Settlement",
  settled:            "Settled",
  returned:           "Returned",
  failed:             "Failed",
  cancelled:          "Cancelled",
};

export const BANK_TYPE_LABEL: Record<string, string> = {
  ach_credit:  "ACH Credit",
  ach_debit:   "ACH Debit",
  wire:        "Wire Transfer",
  rtp:         "Real-Time Payment",
  sepa_credit: "SEPA Credit",
  sepa_debit:  "SEPA Debit",
};

export const BANK_STATUS_COLORS: Record<string, string> = {
  initiated:          "bg-slate-100 text-slate-700 border-slate-200",
  submitted:          "bg-blue-100 text-blue-800 border-blue-200",
  pending_settlement: "bg-yellow-100 text-yellow-800 border-yellow-200",
  settled:            "bg-green-100 text-green-800 border-green-200",
  returned:           "bg-red-100 text-red-800 border-red-200",
  failed:             "bg-red-100 text-red-800 border-red-200",
  cancelled:          "bg-slate-100 text-slate-500 border-slate-200",
};

// ─── Cross-border labels ──────────────────────────────────────────────────────

export const XB_STATUS_LABEL: Record<string, string> = {
  initiated:                "Initiated",
  compliance_check:         "Compliance Check",
  fx_converted:             "FX Converted",
  swift_sent:               "SWIFT Sent",
  intermediary_processing:  "Intermediary Processing",
  credited:                 "Credited",
  failed:                   "Failed",
  returned:                 "Returned",
  sanctions_hold:           "Sanctions Hold",
};

export const XB_STATUS_COLORS: Record<string, string> = {
  initiated:                "bg-slate-100 text-slate-700 border-slate-200",
  compliance_check:         "bg-yellow-100 text-yellow-800 border-yellow-200",
  fx_converted:             "bg-blue-100 text-blue-800 border-blue-200",
  swift_sent:               "bg-indigo-100 text-indigo-800 border-indigo-200",
  intermediary_processing:  "bg-purple-100 text-purple-800 border-purple-200",
  credited:                 "bg-green-100 text-green-800 border-green-200",
  failed:                   "bg-red-100 text-red-800 border-red-200",
  returned:                 "bg-orange-100 text-orange-800 border-orange-200",
  sanctions_hold:           "bg-rose-100 text-rose-800 border-rose-200",
};

export const SWIFT_TYPE_LABEL: Record<string, string> = {
  MT103: "MT103 — Customer Credit Transfer",
  MT202: "MT202 — Financial Institution Transfer",
  MT199: "MT199 — Free Format Message",
  MT900: "MT900 — Debit Confirmation",
  MT910: "MT910 — Credit Confirmation",
};
