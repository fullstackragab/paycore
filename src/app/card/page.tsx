"use client";

import { useEffect, useState, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { RefreshCw, CreditCard, TrendingUp, AlertTriangle, Clock } from "lucide-react";
import clsx from "clsx";

import {
  generateTransactions,
  generateChargebacks,
  generateSettlementBatches,
  calcMetrics,
  DEFAULT_CONFIG,
} from "@/lib/simulation/card-engine";
import {
  formatCents,
  formatCentsCompact,
  formatPercent,
  formatDateTime,
  formatDate,
  timeAgo,
  CARD_STATUS_LABEL,
  CHARGEBACK_STATUS_LABEL,
  SETTLEMENT_STATUS_LABEL,
  DECLINE_REASON_LABEL,
  NETWORK_LABEL,
} from "@/lib/data/formatters";
import StatusBadge from "@/components/ui/StatusBadge";
import MetricCard from "@/components/ui/MetricCard";
import CardLifecycle from "@/components/shared/CardLifecycle";
import { CardTransaction, Chargeback, SettlementBatch } from "@/types/payments";

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = ["Overview", "Transactions", "Chargebacks", "Settlement", "Lifecycle"] as const;
type Tab = (typeof TABS)[number];

const NETWORK_COLORS: Record<string, string> = {
  visa:       "#1a1f71",
  mastercard: "#eb001b",
  amex:       "#2e77bc",
  discover:   "#ff6600",
};

const STATUS_CHART_COLORS: Record<string, string> = {
  settled:    "#22c55e",
  authorized: "#3b82f6",
  captured:   "#6366f1",
  clearing:   "#a855f7",
  declined:   "#ef4444",
  chargeback: "#f43f5e",
  refunded:   "#94a3b8",
  reversed:   "#f97316",
  pending:    "#eab308",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildVolumeChart(txns: CardTransaction[]) {
  const buckets: Record<string, number> = {};
  txns.forEach((t) => {
    const hour = new Date(t.createdAt).getHours();
    const key = `${hour.toString().padStart(2, "0")}:00`;
    buckets[key] = (buckets[key] ?? 0) + (t.status !== "declined" ? t.amount : 0);
  });
  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, amount]) => ({ time, amount: Math.round(amount / 100) }));
}

function buildNetworkChart(txns: CardTransaction[]) {
  const counts: Record<string, number> = {};
  txns.forEach((t) => {
    counts[t.cardNetwork] = (counts[t.cardNetwork] ?? 0) + 1;
  });
  return Object.entries(counts).map(([name, value]) => ({ name, value }));
}

function buildStatusChart(txns: CardTransaction[]) {
  const counts: Record<string, number> = {};
  txns.forEach((t) => {
    counts[t.status] = (counts[t.status] ?? 0) + 1;
  });
  return Object.entries(counts).map(([name, value]) => ({ name, value }));
}

function buildDeclineChart(txns: CardTransaction[]) {
  const counts: Record<string, number> = {};
  txns.filter((t) => t.declineReason).forEach((t) => {
    const label = DECLINE_REASON_LABEL[t.declineReason!];
    counts[label] = (counts[label] ?? 0) + 1;
  });
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([reason, count]) => ({ reason, count }));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function OverviewTab({ txns }: { txns: CardTransaction[] }) {
  const metrics = calcMetrics(txns);
  const volumeData  = buildVolumeChart(txns);
  const networkData = buildNetworkChart(txns);
  const statusData  = buildStatusChart(txns);
  const declineData = buildDeclineChart(txns);

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          label="Total volume"
          value={formatCentsCompact(metrics.totalVolume)}
          sub={`${metrics.totalCount.toLocaleString()} transactions`}
          accent="blue"
          trend="up"
          trendLabel="Simulated last 6h"
        />
        <MetricCard
          label="Approval rate"
          value={formatPercent(metrics.approvalRate)}
          sub="Auth success / total"
          accent="green"
          trend={metrics.approvalRate > 0.88 ? "up" : "down"}
          trendLabel={metrics.approvalRate > 0.88 ? "Above target" : "Below 88% target"}
        />
        <MetricCard
          label="Chargeback rate"
          value={formatPercent(metrics.chargebackRate, 2)}
          sub="Chargebacks / settled"
          accent={metrics.chargebackRate > 0.01 ? "red" : "yellow"}
          trend={metrics.chargebackRate > 0.01 ? "down" : "neutral"}
          trendLabel={metrics.chargebackRate > 0.01 ? "Above 1% threshold" : "Within threshold"}
        />
        <MetricCard
          label="Pending settlement"
          value={formatCentsCompact(metrics.pendingSettlement)}
          sub="Auth + captured + clearing"
          accent="purple"
        />
      </div>

      {/* Volume over time */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Transaction volume by hour ($)</h3>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={volumeData}>
            <defs>
              <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="time" tick={{ fontSize: 11, fill: "#94a3b8" }} />
            <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}K`} />
            <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, "Volume"]} />
            <Area type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={2} fill="url(#volGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Network + Status pie charts */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Transactions by network</h3>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={140} height={140}>
              <PieChart>
                <Pie data={networkData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value">
                  {networkData.map((entry) => (
                    <Cell key={entry.name} fill={NETWORK_COLORS[entry.name] ?? "#94a3b8"} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {networkData.map((d) => (
                <div key={d.name} className="flex items-center gap-2 text-xs">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: NETWORK_COLORS[d.name] }} />
                  <span className="text-slate-600 w-20">{NETWORK_LABEL[d.name]}</span>
                  <span className="font-semibold text-slate-900">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Transactions by status</h3>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={140} height={140}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value">
                  {statusData.map((entry) => (
                    <Cell key={entry.name} fill={STATUS_CHART_COLORS[entry.name] ?? "#94a3b8"} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {statusData.map((d) => (
                <div key={d.name} className="flex items-center gap-2 text-xs">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: STATUS_CHART_COLORS[d.name] }} />
                  <span className="text-slate-600 w-20 capitalize">{d.name}</span>
                  <span className="font-semibold text-slate-900">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Decline reasons */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Decline reasons</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={declineData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} />
            <YAxis dataKey="reason" type="category" tick={{ fontSize: 11, fill: "#64748b" }} width={140} />
            <Tooltip />
            <Bar dataKey="count" fill="#ef4444" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Fee breakdown */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Fee breakdown</h3>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Interchange fees",  value: formatCentsCompact(metrics.totalFees * 0.78), color: "text-blue-600" },
            { label: "Scheme fees",       value: formatCentsCompact(metrics.totalFees * 0.08), color: "text-purple-600" },
            { label: "Processing fees",   value: formatCentsCompact(metrics.totalFees * 0.14), color: "text-slate-600" },
          ].map((f) => (
            <div key={f.label} className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs text-slate-500">{f.label}</p>
              <p className={`mt-1 text-lg font-semibold ${f.color}`}>{f.value}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-lg bg-slate-900 p-4 flex items-center justify-between">
          <span className="text-sm text-slate-300">Net revenue after fees</span>
          <span className="text-lg font-semibold text-white">{formatCentsCompact(metrics.netRevenue)}</span>
        </div>
      </div>
    </div>
  );
}

function TransactionsTab({ txns }: { txns: CardTransaction[] }) {
  const [selected, setSelected] = useState<CardTransaction | null>(null);
  const [filter, setFilter]     = useState<string>("all");

  const filtered = filter === "all" ? txns : txns.filter((t) => t.status === filter);

  return (
    <div className="flex gap-5">
      {/* Table */}
      <div className="flex-1 min-w-0">
        {/* Filter bar */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {["all", "settled", "authorized", "clearing", "declined", "chargeback", "refunded"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={clsx(
                "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                filter === s
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
              )}
            >
              {s === "all" ? "All" : CARD_STATUS_LABEL[s as keyof typeof CARD_STATUS_LABEL]}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-3 text-left font-medium text-slate-500">ID</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Merchant</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Amount</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Network</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 60).map((t) => (
                <tr
                  key={t.id}
                  onClick={() => setSelected(t)}
                  className={clsx(
                    "border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors",
                    selected?.id === t.id && "bg-blue-50"
                  )}
                >
                  <td className="px-4 py-2.5 font-mono text-slate-500">{t.id}</td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-slate-900">{t.merchantName}</div>
                    <div className="text-slate-400">{t.merchantCategory}</div>
                  </td>
                  <td className="px-4 py-2.5 font-semibold text-slate-900">{formatCents(t.amount)}</td>
                  <td className="px-4 py-2.5 capitalize text-slate-600">{NETWORK_LABEL[t.cardNetwork]}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge
                      status={t.status}
                      type="card"
                      label={CARD_STATUS_LABEL[t.status]}
                      size="sm"
                    />
                  </td>
                  <td className="px-4 py-2.5 text-slate-400">{timeAgo(t.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="w-80 shrink-0">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5 sticky top-4 space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-slate-900">{selected.merchantName}</p>
                <p className="text-xs text-slate-400 mt-0.5">{selected.id}</p>
              </div>
              <StatusBadge status={selected.status} type="card" label={CARD_STATUS_LABEL[selected.status]} />
            </div>

            <div className="text-2xl font-semibold text-slate-900">{formatCents(selected.amount)}</div>

            {selected.declineReason && (
              <div className="rounded-lg bg-red-50 border border-red-100 p-3">
                <p className="text-xs font-medium text-red-700">Decline reason</p>
                <p className="text-xs text-red-600 mt-0.5">{DECLINE_REASON_LABEL[selected.declineReason]}</p>
              </div>
            )}

            <div className="space-y-2">
              {[
                ["Network",      NETWORK_LABEL[selected.cardNetwork]],
                ["Issuer",       selected.issuingBank],
                ["Acquirer",     selected.acquiringBank],
                ["Auth code",    selected.authCode ?? "—"],
                ["RRN",          selected.rrn ?? "—"],
                ["Card present", selected.isCardPresent ? "Yes" : "No"],
                ["3-D Secure",   selected.is3DSecure ? "Yes" : "No"],
                ["International",selected.isInternational ? "Yes" : "No"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs">
                  <span className="text-slate-400">{k}</span>
                  <span className="font-medium text-slate-700">{v}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Fee breakdown</p>
              {[
                ["Gross amount",    formatCents(selected.amount)],
                ["Interchange",    `−${formatCents(selected.interchangeFee)}`],
                ["Scheme fee",     `−${formatCents(selected.schemeFee)}`],
                ["Processing fee", `−${formatCents(selected.processingFee)}`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs">
                  <span className="text-slate-400">{k}</span>
                  <span className="font-medium text-slate-700">{v}</span>
                </div>
              ))}
              <div className="flex justify-between text-xs border-t border-slate-100 pt-2">
                <span className="font-semibold text-slate-700">Net settlement</span>
                <span className="font-semibold text-green-600">{formatCents(selected.netSettlement)}</span>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Timeline</p>
              {[
                ["Created",    selected.createdAt],
                ["Authorized", selected.authorizedAt],
                ["Captured",   selected.capturedAt],
                ["Cleared",    selected.clearedAt],
                ["Settled",    selected.settledAt],
              ].map(([label, ts]) => (
                <div key={label} className="flex justify-between text-xs">
                  <span className={clsx("", ts ? "text-slate-400" : "text-slate-200")}>{label}</span>
                  <span className={clsx("font-medium", ts ? "text-slate-700" : "text-slate-200")}>
                    {ts ? formatDateTime(ts) : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ChargebacksTab({ chargebacks }: { chargebacks: Chargeback[] }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Open cases",     value: chargebacks.filter(c => !["won","lost"].includes(c.status)).length, color: "border-l-yellow-500" },
          { label: "Won",            value: chargebacks.filter(c => c.status === "won").length,  color: "border-l-green-500" },
          { label: "Lost",           value: chargebacks.filter(c => c.status === "lost").length, color: "border-l-red-500" },
        ].map((m) => (
          <div key={m.label} className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm border-l-4 ${m.color}`}>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{m.label}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="px-4 py-3 text-left font-medium text-slate-500">Case ID</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Transaction</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Amount</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Reason</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Status</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Deadline</th>
            </tr>
          </thead>
          <tbody>
            {chargebacks.map((cb) => (
              <tr key={cb.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-slate-500">{cb.id}</td>
                <td className="px-4 py-3 font-mono text-slate-400">{cb.transactionId}</td>
                <td className="px-4 py-3 font-semibold text-slate-900">{formatCents(cb.amount)}</td>
                <td className="px-4 py-3 capitalize text-slate-600">{cb.reason.replace(/_/g, " ")}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={cb.status} type="chargeback" label={CHARGEBACK_STATUS_LABEL[cb.status]} size="sm" />
                </td>
                <td className="px-4 py-3 text-slate-400">{formatDate(cb.deadlineAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SettlementTab({ batches }: { batches: SettlementBatch[] }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="px-4 py-3 text-left font-medium text-slate-500">Batch</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Date</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Transactions</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Gross</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Fees</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Net</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Processor</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-slate-500">{b.id}</td>
                <td className="px-4 py-3 text-slate-700">{formatDate(b.date)}</td>
                <td className="px-4 py-3 text-slate-700">{b.transactionCount.toLocaleString()}</td>
                <td className="px-4 py-3 font-semibold text-slate-900">{formatCentsCompact(b.grossAmount)}</td>
                <td className="px-4 py-3 text-red-600">−{formatCentsCompact(b.totalFees)}</td>
                <td className="px-4 py-3 font-semibold text-green-600">{formatCentsCompact(b.netAmount)}</td>
                <td className="px-4 py-3 text-slate-600">{b.processor}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={b.status} type="settlement" label={SETTLEMENT_STATUS_LABEL[b.status]} size="sm" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CardPage() {
  const [tab,         setTab]         = useState<Tab>("Overview");
  const [txns,        setTxns]        = useState<CardTransaction[]>([]);
  const [chargebacks, setChargebacks] = useState<Chargeback[]>([]);
  const [batches,     setBatches]     = useState<SettlementBatch[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [refreshing,  setRefreshing]  = useState(false);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      const newTxns = generateTransactions(150, DEFAULT_CONFIG);
      setTxns(newTxns);
      setChargebacks(generateChargebacks(newTxns));
      setBatches(generateSettlementBatches());
      setLastRefresh(new Date());
      setRefreshing(false);
    }, 400);
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <div className="px-8 py-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="h-5 w-5 text-blue-600" />
            <h1 className="text-xl font-semibold text-slate-900">Card Payments</h1>
            <span className="relative flex h-2 w-2 ml-1">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Authorization → Capture → Clearing → Settlement → Reconciliation
            &nbsp;·&nbsp; Auto-refreshes every 30s
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
            <RefreshCw className={clsx("h-3.5 w-3.5", refreshing && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === t
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === "Overview"      && <OverviewTab      txns={txns} />}
      {tab === "Transactions"  && <TransactionsTab  txns={txns} />}
      {tab === "Chargebacks"   && <ChargebacksTab   chargebacks={chargebacks} />}
      {tab === "Settlement"    && <SettlementTab    batches={batches} />}
      {tab === "Lifecycle"    && <CardLifecycle />}
    </div>
  );
}
