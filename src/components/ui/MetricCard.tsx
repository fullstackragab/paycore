interface Props {
  label: string;
  value: string;
  sub?: string;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  accent?: "green" | "red" | "yellow" | "blue" | "purple";
}

export default function MetricCard({ label, value, sub, trend, trendLabel, accent }: Props) {
  const valueColor =
    accent === "red"    ? "#dc2626" :
    accent === "green"  ? "#15803d" :
    accent === "yellow" ? "#ca8a04" :
    "#111827";

  const trendColor =
    trend === "up"   ? "#15803d" :
    trend === "down" ? "#dc2626" :
    "#9ca3af";

  return (
    <div style={{
      background: "#ffffff",
      border: "1px solid #e5e7eb",
      borderRadius: 6,
      padding: "14px 16px",
    }}>
      <p style={{ fontSize: 10, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0, fontWeight: 500 }}>
        {label}
      </p>
      <p style={{ fontSize: 22, fontWeight: 600, color: valueColor, margin: "4px 0 0", fontVariantNumeric: "tabular-nums" }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: 11, color: "#9ca3af", margin: "2px 0 0" }}>{sub}</p>}
      {trend && trendLabel && (
        <p style={{ fontSize: 11, color: trendColor, margin: "6px 0 0", fontWeight: 500 }}>
          {trend === "up" ? "up" : trend === "down" ? "dn" : "—"} {trendLabel}
        </p>
      )}
    </div>
  );
}
