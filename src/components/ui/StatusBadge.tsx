import clsx from "clsx";
import { CardTransactionStatus, ChargebackStatus, SettlementStatus } from "@/types/payments";

// ─── Color map ────────────────────────────────────────────────────────────────

const CARD_STATUS_COLORS: Record<CardTransactionStatus, string> = {
  pending:    "bg-yellow-100 text-yellow-800 border-yellow-200",
  authorized: "bg-blue-100 text-blue-800 border-blue-200",
  captured:   "bg-indigo-100 text-indigo-800 border-indigo-200",
  clearing:   "bg-purple-100 text-purple-800 border-purple-200",
  settled:    "bg-green-100 text-green-800 border-green-200",
  declined:   "bg-red-100 text-red-800 border-red-200",
  reversed:   "bg-orange-100 text-orange-800 border-orange-200",
  chargeback: "bg-rose-100 text-rose-800 border-rose-200",
  refunded:   "bg-slate-100 text-slate-700 border-slate-200",
};

const CHARGEBACK_STATUS_COLORS: Record<ChargebackStatus, string> = {
  received:           "bg-yellow-100 text-yellow-800 border-yellow-200",
  under_review:       "bg-blue-100 text-blue-800 border-blue-200",
  evidence_submitted: "bg-purple-100 text-purple-800 border-purple-200",
  won:                "bg-green-100 text-green-800 border-green-200",
  lost:               "bg-red-100 text-red-800 border-red-200",
};

const SETTLEMENT_STATUS_COLORS: Record<SettlementStatus, string> = {
  pending:    "bg-yellow-100 text-yellow-800 border-yellow-200",
  processing: "bg-blue-100 text-blue-800 border-blue-200",
  complete:   "bg-green-100 text-green-800 border-green-200",
  failed:     "bg-red-100 text-red-800 border-red-200",
};

// ─── Dot indicator ────────────────────────────────────────────────────────────

const LIVE_STATUSES = new Set(["authorized", "captured", "clearing", "processing", "received", "under_review"]);

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  status: CardTransactionStatus | ChargebackStatus | SettlementStatus;
  type: "card" | "chargeback" | "settlement";
  label: string;
  size?: "sm" | "md";
}

export default function StatusBadge({ status, type, label, size = "md" }: Props) {
  const colorMap =
    type === "card"        ? CARD_STATUS_COLORS :
    type === "chargeback"  ? CHARGEBACK_STATUS_COLORS :
                             SETTLEMENT_STATUS_COLORS;

  const colors = (colorMap as Record<string, string>)[status] ?? "bg-gray-100 text-gray-700 border-gray-200";
  const isLive = LIVE_STATUSES.has(status);

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs",
        colors
      )}
    >
      {isLive && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-current" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current" />
        </span>
      )}
      {label}
    </span>
  );
}
