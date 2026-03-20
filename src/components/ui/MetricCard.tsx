interface Props {
  label: string;
  value: string;
  sub?: string;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  accent?: "green" | "red" | "yellow" | "blue" | "purple";
}

const TREND_COLORS = {
  up:      "text-green-700",
  down:    "text-red-600",
  neutral: "text-gray-400",
};

const TREND_ICONS = { up: "↑", down: "↓", neutral: "→" };

export default function MetricCard({ label, value, sub, trend, trendLabel, accent }: Props) {
  const valueColor =
    accent === "red"    ? "text-red-600"   :
    accent === "green"  ? "text-green-700" :
    accent === "yellow" ? "text-yellow-600":
    "text-gray-900";

  return (
    <div className="bg-white border border-gray-200 rounded p-4">
      <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${valueColor}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
      {trend && trendLabel && (
        <p className={`mt-1.5 text-xs font-medium ${TREND_COLORS[trend]}`}>
          {TREND_ICONS[trend]} {trendLabel}
        </p>
      )}
    </div>
  );
}
