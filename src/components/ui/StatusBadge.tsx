import clsx from "clsx";
import { CardTransactionStatus, ChargebackStatus, SettlementStatus } from "@/types/payments";

// ─── Color map — text only, no backgrounds ────────────────────────────────────

const CARD_STATUS_COLORS: Record<CardTransactionStatus, string> = {
  pending:    "text-yellow-600",
  authorized: "text-blue-600",
  captured:   "text-blue-700",
  clearing:   "text-gray-600",
  settled:    "text-green-700",
  declined:   "text-red-600",
  reversed:   "text-orange-600",
  chargeback: "text-red-700",
  refunded:   "text-gray-500",
};

const CHARGEBACK_STATUS_COLORS: Record<ChargebackStatus, string> = {
  received:           "text-yellow-600",
  under_review:       "text-blue-600",
  evidence_submitted: "text-gray-600",
  won:                "text-green-700",
  lost:               "text-red-600",
};

const SETTLEMENT_STATUS_COLORS: Record<SettlementStatus, string> = {
  pending:    "text-yellow-600",
  processing: "text-blue-600",
  complete:   "text-green-700",
  failed:     "text-red-600",
};

const LIVE_STATUSES = new Set([
  "authorized", "captured", "clearing", "processing", "received", "under_review",
]);

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

  const color = (colorMap as Record<string, string>)[status] ?? "text-gray-500";
  const isLive = LIVE_STATUSES.has(status);
  const sz = size === "sm" ? "text-xs" : "text-xs";

  return (
    <span className={clsx("inline-flex items-center gap-1 font-medium", sz, color)}>
      {isLive
        ? <span className="inline-block h-1.5 w-1.5 rounded-full bg-current opacity-70 animate-pulse" />
        : <span className="inline-block h-1.5 w-1.5 rounded-full bg-current opacity-40" />
      }
      {label}
    </span>
  );
}
