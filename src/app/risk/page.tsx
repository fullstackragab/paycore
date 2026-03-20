"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts";
import {
  ShieldAlert,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import clsx from "clsx";

import {
  generateRiskEvents,
  generateFraudCases,
  generateRiskRules,
  calcRiskMetrics,
} from "@/lib/simulation/risk-engine";
import {
  formatCents,
  formatCentsCompact,
  formatPercent,
  timeAgo,
  formatDateTime,
} from "@/lib/data/formatters";
import { RiskEvent, FraudCase, RiskRule } from "@/types/payments";
import MetricCard from "@/components/ui/MetricCard";

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  "Overview",
  "Live feed",
  "Review queue",
  "Fraud cases",
  "Rules",
  "Concepts",
] as const;
type Tab = (typeof TABS)[number];

const DECISION_COLORS: Record<string, string> = {
  approve: "bg-green-100 text-green-800 border-green-200",
  decline: "bg-red-100 text-red-800 border-red-200",
  review: "bg-yellow-100 text-yellow-800 border-yellow-200",
  challenge_3ds: "bg-gray-50 text-blue-800 border-gray-200",
};

const DECISION_LABEL: Record<string, string> = {
  approve: "Approved",
  decline: "Declined",
  review: "Manual review",
  challenge_3ds: "3DS Challenge",
};

const REVIEW_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  declined: "bg-red-100 text-red-800",
  escalated: "bg-gray-50 text-orange-800",
};

const FRAUD_TYPE_LABEL: Record<string, string> = {
  card_not_present: "Card-not-present",
  account_takeover: "Account takeover",
  friendly_fraud: "Friendly fraud",
  identity_theft: "Identity theft",
  merchant_fraud: "Merchant fraud",
  mule_account: "Mule account",
  social_engineering: "Social engineering",
  velocity_abuse: "Velocity abuse",
};

const CATEGORY_COLORS: Record<string, string> = {
  velocity: "#3b82f6",
  device: "#8b5cf6",
  geo: "#f59e0b",
  amount: "#10b981",
  behavioral: "#ec4899",
};

function riskColor(score: number): string {
  if (score >= 700) return "text-red-600";
  if (score >= 500) return "text-orange-600";
  if (score >= 350) return "text-yellow-600";
  return "text-green-600";
}

function riskBg(score: number): string {
  if (score >= 700) return "bg-red-50";
  if (score >= 500) return "bg-gray-50";
  if (score >= 350) return "bg-yellow-50";
  return "bg-green-50";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DecisionBadge({ decision }: { decision: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
        DECISION_COLORS[decision] ?? "bg-slate-100 text-slate-600",
      )}
    >
      {DECISION_LABEL[decision] ?? decision}
    </span>
  );
}

function RiskScoreBar({ score }: { score: number }) {
  const pct = (score / 1000) * 100;
  const color =
    score >= 700
      ? "bg-red-500"
      : score >= 500
        ? "bg-gray-50"
        : score >= 350
          ? "bg-yellow-500"
          : "bg-green-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={clsx("h-full rounded-full", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={clsx(
          "text-xs font-semibold tabular-nums w-8 text-right",
          riskColor(score),
        )}
      >
        {score}
      </span>
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function OverviewTab({ events }: { events: RiskEvent[] }) {
  const metrics = calcRiskMetrics(events);

  const decisionData = [
    {
      name: "Approved",
      value: Math.round(metrics.approvalRate * 100),
      fill: "#22c55e",
    },
    {
      name: "Declined",
      value: Math.round(metrics.declineRate * 100),
      fill: "#ef4444",
    },
    {
      name: "Review",
      value: Math.round(metrics.reviewRate * 100),
      fill: "#eab308",
    },
    {
      name: "3DS",
      value: Math.round(
        (1 - metrics.approvalRate - metrics.declineRate - metrics.reviewRate) *
          100,
      ),
      fill: "#3b82f6",
    },
  ];

  const scoreDistribution = [
    { range: "0–200", count: events.filter((e) => e.riskScore < 200).length },
    {
      range: "200–350",
      count: events.filter((e) => e.riskScore >= 200 && e.riskScore < 350)
        .length,
    },
    {
      range: "350–500",
      count: events.filter((e) => e.riskScore >= 350 && e.riskScore < 500)
        .length,
    },
    {
      range: "500–700",
      count: events.filter((e) => e.riskScore >= 500 && e.riskScore < 700)
        .length,
    },
    { range: "700+", count: events.filter((e) => e.riskScore >= 700).length },
  ];

  const scoreColors = ["#22c55e", "#84cc16", "#eab308", "#f97316", "#ef4444"];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          label="Avg risk score"
          value={String(metrics.avgRiskScore)}
          sub="0 = safe, 1000 = certain fraud"
          accent={metrics.avgRiskScore > 400 ? "red" : "green"}
        />
        <MetricCard
          label="Fraud rate"
          value={formatPercent(metrics.fraudRate, 2)}
          sub="Confirmed fraud / total"
          accent="red"
        />
        <MetricCard
          label="False positive rate"
          value={formatPercent(metrics.falsePositiveRate, 1)}
          sub="Legit txns sent to review"
          accent="yellow"
        />
        <MetricCard
          label="Fraud loss"
          value={formatCentsCompact(metrics.fraudLoss)}
          sub={`Recovered: ${formatCentsCompact(metrics.recoveredAmount)}`}
          accent="red"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">
            Decision distribution (%)
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={decisionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip formatter={(v) => [`${Number(v)}%`, "Share"]} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {decisionData.map((d, i) => (
                  <Cell key={i} fill={d.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">
            Risk score distribution
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={scoreDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="range" tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <Tooltip />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {scoreDistribution.map((_, i) => (
                  <Cell key={i} fill={scoreColors[i]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* The tradeoff panel */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 mb-1">
          The fundamental fraud tradeoff
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          You cannot maximise all three simultaneously — every risk system is a
          balancing act
        </p>
        <div className="grid grid-cols-3 gap-4">
          {[
            {
              label: "Approval rate",
              value: formatPercent(metrics.approvalRate),
              icon: CheckCircle,
              color: "text-green-600",
              bg: "bg-green-50 border-green-200",
              desc: "Higher approval rate = more revenue but more fraud loss. Declining legitimate customers destroys trust and revenue.",
            },
            {
              label: "Fraud rate",
              value: formatPercent(metrics.fraudRate, 2),
              icon: ShieldAlert,
              color: "text-red-600",
              bg: "bg-red-50 border-red-200",
              desc: "Lower fraud rate = fewer losses but requires more declines. Card networks penalise merchants above 1% chargeback rate.",
            },
            {
              label: "False positive rate",
              value: formatPercent(metrics.falsePositiveRate, 1),
              icon: AlertTriangle,
              color: "text-yellow-600",
              bg: "bg-yellow-50 border-yellow-200",
              desc: "False positives = legitimate transactions blocked. Each one is a lost sale and a frustrated customer who may never return.",
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className={clsx("rounded-xl border p-4", item.bg)}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="h-4 w-4 text-gray-500" />
                  <span className="text-xs font-semibold text-slate-700">
                    {item.label}
                  </span>
                </div>
                <p className={clsx("text-2xl font-semibold mb-2", item.color)}>
                  {item.value}
                </p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function LiveFeedTab({ events }: { events: RiskEvent[] }) {
  const [selected, setSelected] = useState<RiskEvent | null>(null);

  return (
    <div className="flex gap-5">
      <div className="flex-1 min-w-0">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {[
                  "Risk score",
                  "Transaction",
                  "Merchant",
                  "Amount",
                  "IP country",
                  "Signals",
                  "Decision",
                  "Time",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-3 text-left font-medium text-slate-500"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.slice(0, 80).map((e) => (
                <tr
                  key={e.id}
                  onClick={() => setSelected(e)}
                  className={clsx(
                    "border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors",
                    selected?.id === e.id && "bg-gray-50",
                    e.riskScore >= 700 && "bg-red-50 hover:bg-red-100",
                  )}
                >
                  <td className="px-3 py-2.5">
                    <RiskScoreBar score={e.riskScore} />
                  </td>
                  <td className="px-3 py-2.5 font-mono text-slate-400">
                    {e.transactionId}
                  </td>
                  <td className="px-3 py-2.5 text-slate-700">
                    {e.merchantName}
                  </td>
                  <td className="px-3 py-2.5 font-semibold text-slate-900">
                    {formatCents(e.amount)}
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{e.ipCountry}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1 flex-wrap">
                      {e.isVPNOrProxy && (
                        <span className="rounded bg-gray-50 px-1 text-[10px] font-medium text-purple-700">
                          VPN
                        </span>
                      )}
                      {e.countryMismatch && (
                        <span className="rounded bg-gray-50 px-1 text-[10px] font-medium text-orange-700">
                          GEO
                        </span>
                      )}
                      {e.velocityBreached && (
                        <span className="rounded bg-red-100 px-1 text-[10px] font-medium text-red-700">
                          VEL
                        </span>
                      )}
                      {e.isNewDevice && (
                        <span className="rounded bg-gray-50 px-1 text-[10px] font-medium text-blue-700">
                          DEV
                        </span>
                      )}
                      {e.isUnusualAmount && (
                        <span className="rounded bg-green-100 px-1 text-[10px] font-medium text-green-700">
                          AMT
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <DecisionBadge decision={e.decision} />
                  </td>
                  <td className="px-3 py-2.5 text-slate-400">
                    {timeAgo(e.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="w-72 shrink-0">
          <div
            className={clsx(
              "rounded-xl border-2 p-5 sticky top-4 space-y-4",
              riskBg(selected.riskScore),
              selected.riskScore >= 700
                ? "border-red-300"
                : selected.riskScore >= 500
                  ? "border-gray-200"
                  : "border-slate-200",
            )}
          >
            <div>
              <p className="font-semibold text-slate-900">
                {selected.merchantName}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {selected.transactionId}
              </p>
            </div>

            <div className="text-center py-3">
              <p
                className={clsx(
                  "text-5xl font-bold",
                  riskColor(selected.riskScore),
                )}
              >
                {selected.riskScore}
              </p>
              <p className="text-xs text-slate-400 mt-1">Risk score / 1000</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  label: "Fraud prob",
                  value: formatPercent(selected.fraudProbability, 1),
                },
                { label: "Device score", value: `${selected.deviceScore}/100` },
                { label: "Velocity", value: `${selected.velocityScore}/100` },
                { label: "IP country", value: selected.ipCountry },
                { label: "Card country", value: selected.cardCountry },
                {
                  label: "Mismatch",
                  value: selected.countryMismatch ? "Yes" : "No",
                },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg bg-white p-2">
                  <p className="text-[10px] text-gray-400">{label}</p>
                  <p className="text-xs font-semibold text-gray-900">{value}</p>
                </div>
              ))}
            </div>

            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Signals
              </p>
              {[
                ["New device", selected.isNewDevice],
                ["VPN / proxy", selected.isVPNOrProxy],
                ["High-risk country", selected.isHighRiskCountry],
                ["Unusual hour", selected.isUnusualHour],
                ["Unusual amount", selected.isUnusualAmount],
                ["Velocity breach", selected.velocityBreached],
                ["Country mismatch", selected.countryMismatch],
              ].map(([label, active]) => (
                <div
                  key={String(label)}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-slate-500">{String(label)}</span>
                  <span
                    className={
                      active ? "text-red-600 font-semibold" : "text-slate-300"
                    }
                  >
                    {active ? "● Triggered" : "○ Clear"}
                  </span>
                </div>
              ))}
            </div>

            {selected.rulesTriggered.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Rules triggered
                </p>
                {selected.rulesTriggered.map((r) => (
                  <span
                    key={r}
                    className="inline-block mr-1 mb-1 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-slate-700"
                  >
                    {r}
                  </span>
                ))}
              </div>
            )}

            <div className="border-t border-white pt-3">
              <DecisionBadge decision={selected.decision} />
              {selected.reviewStatus && (
                <span
                  className={clsx(
                    "ml-2 rounded-full px-2 py-1 text-[10px] font-medium",
                    REVIEW_COLORS[selected.reviewStatus],
                  )}
                >
                  {selected.reviewStatus}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewQueueTab({ events }: { events: RiskEvent[] }) {
  const queue = events.filter((e) => e.decision === "review");
  const pending = queue.filter((e) => e.reviewStatus === "pending");
  const completed = queue.filter((e) => e.reviewStatus !== "pending");

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-4">
        {[
          {
            label: "Pending review",
            value: pending.length,
            color: "border-l-yellow-500",
          },
          {
            label: "Approved",
            value: queue.filter((e) => e.reviewStatus === "approved").length,
            color: "border-l-green-500",
          },
          {
            label: "Declined",
            value: queue.filter((e) => e.reviewStatus === "declined").length,
            color: "border-l-red-500",
          },
          {
            label: "Escalated",
            value: queue.filter((e) => e.reviewStatus === "escalated").length,
            color: "border-l-gray-300",
          },
        ].map((m) => (
          <div
            key={m.label}
            className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm border-l-4 ${m.color}`}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {m.label}
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {m.value}
            </p>
          </div>
        ))}
      </div>

      {pending.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-yellow-500" /> Pending review (
            {pending.length})
          </h3>
          <div className="rounded-xl border border-yellow-200 bg-yellow-50 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-yellow-200 bg-yellow-100">
                  {[
                    "ID",
                    "Merchant",
                    "Amount",
                    "Risk score",
                    "Signals",
                    "Waiting",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left font-medium text-yellow-800"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pending.map((e) => (
                  <tr
                    key={e.id}
                    className="border-b border-yellow-100 hover:bg-yellow-100"
                  >
                    <td className="px-4 py-2.5 font-mono text-slate-500">
                      {e.id}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-900">
                      {e.merchantName}
                    </td>
                    <td className="px-4 py-2.5 font-semibold">
                      {formatCents(e.amount)}
                    </td>
                    <td className="px-4 py-2.5">
                      <RiskScoreBar score={e.riskScore} />
                    </td>
                    <td className="px-4 py-2.5">
                      {e.rulesTriggered.join(", ") || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {timeAgo(e.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">
          Completed reviews
        </h3>
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {[
                  "ID",
                  "Merchant",
                  "Amount",
                  "Risk score",
                  "Outcome",
                  "Reviewed by",
                  "Note",
                  "Reviewed",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2.5 text-left font-medium text-slate-500"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {completed.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-slate-50 hover:bg-slate-50"
                >
                  <td className="px-3 py-2.5 font-mono text-slate-400">
                    {e.id}
                  </td>
                  <td className="px-3 py-2.5 font-medium text-slate-900">
                    {e.merchantName}
                  </td>
                  <td className="px-3 py-2.5 font-semibold">
                    {formatCents(e.amount)}
                  </td>
                  <td className="px-3 py-2.5 w-32">
                    <RiskScoreBar score={e.riskScore} />
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={clsx(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        REVIEW_COLORS[e.reviewStatus!],
                      )}
                    >
                      {e.reviewStatus}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">
                    {e.reviewedBy ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 text-slate-500 max-w-[180px] truncate">
                    {e.reviewNote ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 text-slate-400">
                    {e.reviewedAt ? timeAgo(e.reviewedAt) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FraudCasesTab({ cases }: { cases: FraudCase[] }) {
  const byType = Object.entries(
    cases.reduce(
      (acc, c) => {
        acc[c.fraudType] = (acc[c.fraudType] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    ),
  )
    .map(([name, value]) => ({ name: FRAUD_TYPE_LABEL[name] ?? name, value }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-l-4 border-red-500 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Total cases
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {cases.length}
          </p>
        </div>
        <div className="rounded-xl border border-l-4 border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Total loss
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {formatCentsCompact(cases.reduce((s, c) => s + c.lossAmount, 0))}
          </p>
        </div>
        <div className="rounded-xl border border-l-4 border-green-500 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Recovered
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {formatCentsCompact(
              cases.reduce((s, c) => s + c.recoveredAmount, 0),
            )}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">
          Cases by fraud type
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={byType} layout="vertical">
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#f1f5f9"
              horizontal={false}
            />
            <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} />
            <YAxis
              dataKey="name"
              type="category"
              tick={{ fontSize: 11, fill: "#64748b" }}
              width={160}
            />
            <Tooltip />
            <Bar dataKey="value" fill="#ef4444" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              {[
                "Case ID",
                "Type",
                "Merchant",
                "Amount",
                "Loss",
                "Recovered",
                "Status",
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left font-medium text-slate-500"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => (
              <tr
                key={c.id}
                className="border-b border-slate-50 hover:bg-slate-50"
              >
                <td className="px-4 py-2.5 font-mono text-slate-400">{c.id}</td>
                <td className="px-4 py-2.5 text-slate-700">
                  {FRAUD_TYPE_LABEL[c.fraudType]}
                </td>
                <td className="px-4 py-2.5 font-medium text-slate-900">
                  {c.merchantName}
                </td>
                <td className="px-4 py-2.5 font-semibold">
                  {formatCents(c.amount)}
                </td>
                <td className="px-4 py-2.5 text-red-600 font-medium">
                  {formatCents(c.lossAmount)}
                </td>
                <td className="px-4 py-2.5 text-green-600">
                  {formatCents(c.recoveredAmount)}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={clsx(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      c.status === "confirmed"
                        ? "bg-red-100 text-red-700"
                        : c.status === "dismissed"
                          ? "bg-slate-100 text-slate-600"
                          : c.status === "investigating"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-gray-50 text-orange-700",
                    )}
                  >
                    {c.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RulesTab({ rules }: { rules: RiskRule[] }) {
  const [active, setActive] = useState<RiskRule | null>(null);
  const byCategory = rules.reduce(
    (acc, r) => {
      (acc[r.category] = acc[r.category] ?? []).push(r);
      return acc;
    },
    {} as Record<string, RiskRule[]>,
  );

  return (
    <div className="flex gap-5">
      <div className="flex-1 min-w-0 space-y-4">
        {Object.entries(byCategory).map(([category, categoryRules]) => (
          <div key={category}>
            <div className="flex items-center gap-2 mb-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: CATEGORY_COLORS[category] }}
              />
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 capitalize">
                {category}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    {[
                      "Rule ID",
                      "Name",
                      "Action",
                      "Triggered",
                      "False positive rate",
                      "Active",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-2.5 text-left font-medium text-slate-500"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {categoryRules.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => setActive(r)}
                      className={clsx(
                        "border-b border-slate-50 cursor-pointer hover:bg-slate-50",
                        active?.id === r.id && "bg-gray-50",
                      )}
                    >
                      <td className="px-4 py-2.5 font-mono font-semibold text-slate-600">
                        {r.id}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-slate-900">
                        {r.name}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={clsx(
                            "rounded-full px-2 py-0.5 text-xs font-medium",
                            r.action === "decline"
                              ? "bg-red-100 text-red-700"
                              : r.action === "flag"
                                ? "bg-yellow-100 text-yellow-700"
                                : r.action === "challenge"
                                  ? "bg-gray-50 text-blue-700"
                                  : "bg-green-100 text-green-700",
                          )}
                        >
                          {r.action}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-slate-900">
                        {r.triggeredCount.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full">
                            <div
                              className={clsx(
                                "h-full rounded-full",
                                r.falsePositiveRate > 0.4
                                  ? "bg-red-400"
                                  : r.falsePositiveRate > 0.2
                                    ? "bg-yellow-400"
                                    : "bg-green-400",
                              )}
                              style={{ width: `${r.falsePositiveRate * 100}%` }}
                            />
                          </div>
                          <span className="text-slate-600 w-8 text-right">
                            {formatPercent(r.falsePositiveRate, 0)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={clsx(
                            "rounded-full px-2 py-0.5 text-xs font-medium",
                            r.isActive
                              ? "bg-green-100 text-green-700"
                              : "bg-slate-100 text-slate-500",
                          )}
                        >
                          {r.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {active && (
        <div className="w-72 shrink-0">
          <div className="rounded-xl border border-slate-200 bg-white p-5 sticky top-4 space-y-4 shadow-sm">
            <div>
              <p className="font-mono font-semibold text-slate-600 text-xs">
                {active.id}
              </p>
              <p className="font-semibold text-slate-900 mt-1">{active.name}</p>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              {active.description}
            </p>
            <div className="space-y-2">
              {[
                ["Category", active.category],
                ["Action", active.action],
                ["Times triggered", active.triggeredCount.toLocaleString()],
                [
                  "False positive rate",
                  formatPercent(active.falsePositiveRate, 1),
                ],
                ["Status", active.isActive ? "Active" : "Inactive"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs">
                  <span className="text-slate-400">{k}</span>
                  <span className="font-medium text-slate-700">{v}</span>
                </div>
              ))}
            </div>
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
              <p className="text-xs text-amber-800">
                <strong>
                  False positive rate{" "}
                  {formatPercent(active.falsePositiveRate, 0)}
                </strong>{" "}
                — for every 100 times this rule fires,{" "}
                {Math.round(active.falsePositiveRate * 100)} are legitimate
                transactions incorrectly blocked.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ConceptsTab() {
  const concepts = [
    {
      title: "Risk score",
      color: "border-l-gray-300",
      body: "A numeric score (0–1000) representing the likelihood that a transaction is fraudulent. Calculated by combining signals: device trust, velocity, geo mismatch, behavioral patterns. Score thresholds map to decisions: approve, 3DS challenge, manual review, or decline.",
    },
    {
      title: "The approval rate / fraud rate tradeoff",
      color: "border-l-red-500",
      body: "Every risk system has a threshold. Lowering it blocks more fraud but also more legitimate transactions (false positives). Raising it approves more legitimate transactions but lets more fraud through. The optimal threshold depends on the business: a bank has different tolerance than a gaming platform.",
    },
    {
      title: "Velocity controls",
      color: "border-l-gray-300",
      body: "Rules that count events over a time window. Example: block if > 5 transactions on the same card in 10 minutes. Velocity checks happen in real time using sliding window counters in Redis or similar. They catch card testing attacks — fraudsters make small test transactions before big ones.",
    },
    {
      title: "Device fingerprinting",
      color: "border-l-gray-300",
      body: "Creating a unique identifier for a device using browser/OS signals: user agent, screen resolution, installed fonts, WebGL renderer, battery level, timezone. A returning trusted device has high device score. A new device, especially one using incognito mode or a VM, has low score.",
    },
    {
      title: "Friendly fraud",
      color: "border-l-gray-300",
      body: "When the cardholder IS the fraudster — they make a legitimate purchase and then dispute it as unauthorized to get a refund while keeping the goods. Accounts for 40–80% of chargebacks in e-commerce. Hard to detect because the transaction signals look legitimate. Evidence of delivery is the primary defense.",
    },
    {
      title: "Account takeover (ATO)",
      color: "border-l-gray-300",
      body: "A fraudster gains access to a legitimate account — usually via phishing, credential stuffing, or social engineering. They change the email/password/phone then make purchases. ATO is detected by: impossible travel, new device from unusual location, sudden change in spending pattern.",
    },
    {
      title: "False positives",
      color: "border-l-yellow-500",
      body: "Legitimate transactions incorrectly blocked. A traveler paying abroad with their home card triggers a geo mismatch rule. A large gift purchase triggers an unusual amount rule. False positives have a real cost: lost revenue, customer frustration, support overhead. Reducing them is as important as reducing fraud.",
    },
    {
      title: "Rule engine vs ML scoring",
      color: "border-l-gray-300",
      body: "Rule engines are fast, explainable, and easy to update. ML models find complex non-linear patterns humans miss. Production fraud systems use both: rule engine for hard blocks (card on watchlist = always decline), ML for probabilistic scoring. Rules handle the obvious cases; ML handles the subtle ones.",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      {concepts.map((c) => (
        <div
          key={c.title}
          className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm border-l-4 ${c.color}`}
        >
          <h3 className="text-sm font-semibold text-slate-900 mb-2">
            {c.title}
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">{c.body}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RiskPage() {
  const [tab, setTab] = useState<Tab>("Overview");
  const [events, setEvents] = useState<RiskEvent[]>([]);
  const [cases, setCases] = useState<FraudCase[]>([]);
  const [rules, setRules] = useState<RiskRule[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const refresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      const newEvents = generateRiskEvents(120);
      setEvents(newEvents);
      setCases(generateFraudCases(newEvents));
      setRules(generateRiskRules());
      setLastRefresh(new Date());
      setRefreshing(false);
    }, 400);
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <div className="px-8 py-8 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="h-5 w-5 text-amber-500" />
            <h1 className="text-xl font-semibold text-slate-900">
              Risk & Fraud
            </h1>
            <span className="relative flex h-2 w-2 ml-1">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Risk scoring · Velocity controls · Device fingerprinting · Manual
            review · Fraud cases · Rule engine
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">
            Updated {lastRefresh.toLocaleTimeString()}
          </span>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 shadow-sm disabled:opacity-50"
          >
            <RefreshCw
              className={clsx("h-3.5 w-3.5", refreshing && "animate-spin")}
            />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === t
                ? "border-gray-200 text-amber-600"
                : "border-transparent text-slate-500 hover:text-slate-700",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && <OverviewTab events={events} />}
      {tab === "Live feed" && <LiveFeedTab events={events} />}
      {tab === "Review queue" && <ReviewQueueTab events={events} />}
      {tab === "Fraud cases" && <FraudCasesTab cases={cases} />}
      {tab === "Rules" && <RulesTab rules={rules} />}
      {tab === "Concepts" && <ConceptsTab />}
    </div>
  );
}
