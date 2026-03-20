import clsx from "clsx";

interface Props {
  label: string;
  value: string;
  sub?: string;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  accent?: "green" | "red" | "blue" | "yellow" | "purple";
}

const ACCENT_COLORS = {
  green:  "border-l-green-500",
  red:    "border-l-red-500",
  blue:   "border-l-blue-500",
  yellow: "border-l-yellow-500",
  purple: "border-l-purple-500",
};

const TREND_COLORS = {
  up:      "text-green-600",
  down:    "text-red-600",
  neutral: "text-slate-500",
};

const TREND_ICONS = {
  up:      "↑",
  down:    "↓",
  neutral: "→",
};

export default function MetricCard({
  label,
  value,
  sub,
  trend,
  trendLabel,
  accent = "blue",
}: Props) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-slate-200 bg-white p-5 shadow-sm",
        "border-l-4",
        ACCENT_COLORS[accent]
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-semibold text-slate-900">{value}</p>
      {sub && (
        <p className="mt-0.5 text-xs text-slate-500">{sub}</p>
      )}
      {trend && trendLabel && (
        <p className={clsx("mt-2 text-xs font-medium", TREND_COLORS[trend])}>
          {TREND_ICONS[trend]} {trendLabel}
        </p>
      )}
    </div>
  );
}
