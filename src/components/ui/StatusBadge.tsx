import { CardTransactionStatus, ChargebackStatus, SettlementStatus } from "@/types/payments";

const CARD_COLORS: Record<CardTransactionStatus, string> = {
  pending:    "#ca8a04",
  authorized: "#2563eb",
  captured:   "#2563eb",
  clearing:   "#6b7280",
  settled:    "#15803d",
  declined:   "#dc2626",
  reversed:   "#ea580c",
  chargeback: "#b91c1c",
  refunded:   "#6b7280",
};

const CB_COLORS: Record<ChargebackStatus, string> = {
  received:           "#ca8a04",
  under_review:       "#2563eb",
  evidence_submitted: "#6b7280",
  won:                "#15803d",
  lost:               "#dc2626",
};

const SETTLE_COLORS: Record<SettlementStatus, string> = {
  pending:    "#ca8a04",
  processing: "#2563eb",
  complete:   "#15803d",
  failed:     "#dc2626",
};

const LIVE = new Set(["authorized","captured","clearing","processing","received","under_review"]);

interface Props {
  status: CardTransactionStatus | ChargebackStatus | SettlementStatus;
  type: "card" | "chargeback" | "settlement";
  label: string;
  size?: "sm" | "md";
}

export default function StatusBadge({ status, type, label }: Props) {
  const map = type === "card" ? CARD_COLORS : type === "chargeback" ? CB_COLORS : SETTLE_COLORS;
  const color = (map as Record<string, string>)[status] ?? "#6b7280";
  const isLive = LIVE.has(status);

  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:12, fontWeight:500, color }}>
      <span style={{
        width:6, height:6, borderRadius:"50%", background:color, flexShrink:0,
        opacity: isLive ? 1 : 0.5,
        animation: isLive ? "pulse 2s ease-in-out infinite" : "none",
      }} />
      {label}
    </span>
  );
}
