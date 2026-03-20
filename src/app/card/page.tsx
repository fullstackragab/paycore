"use client";

import { useEffect, useState, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { RefreshCw } from "lucide-react";
import clsx from "clsx";
import { generateTransactions, generateChargebacks, generateSettlementBatches, calcMetrics, DEFAULT_CONFIG } from "@/lib/simulation/card-engine";
import { formatCents, formatCentsCompact, formatPercent, formatDateTime, formatDate, timeAgo, CARD_STATUS_LABEL, CHARGEBACK_STATUS_LABEL, SETTLEMENT_STATUS_LABEL, DECLINE_REASON_LABEL, NETWORK_LABEL } from "@/lib/data/formatters";
import StatusBadge from "@/components/ui/StatusBadge";
import MetricCard from "@/components/ui/MetricCard";
import CardLifecycle from "@/components/shared/CardLifecycle";
import { CardTransaction, Chargeback, SettlementBatch } from "@/types/payments";

const TABS = ["Overview", "Transactions", "Chargebacks", "Settlement", "Lifecycle"] as const;
type Tab = typeof TABS[number];

function buildVolumeChart(txns: CardTransaction[]) {
  const buckets: Record<string, number> = {};
  txns.forEach((t) => {
    const hour = new Date(t.createdAt).getHours();
    const key = `${hour.toString().padStart(2, "0")}:00`;
    buckets[key] = (buckets[key] ?? 0) + (t.status !== "declined" ? t.amount : 0);
  });
  return Object.entries(buckets).sort(([a], [b]) => a.localeCompare(b))
    .map(([time, amount]) => ({ time, amount: Math.round(amount / 100) }));
}

function buildDeclineChart(txns: CardTransaction[]) {
  const counts: Record<string, number> = {};
  txns.filter((t) => t.declineReason).forEach((t) => {
    const label = DECLINE_REASON_LABEL[t.declineReason!];
    counts[label] = (counts[label] ?? 0) + 1;
  });
  return Object.entries(counts).sort(([, a], [, b]) => b - a)
    .map(([reason, count]) => ({ reason, count }));
}

function OverviewTab({ txns }: { txns: CardTransaction[] }) {
  const metrics = calcMetrics(txns);
  const volumeData = buildVolumeChart(txns);
  const declineData = buildDeclineChart(txns);

  const statusBreakdown = Object.entries(
    txns.reduce((acc, t) => { acc[t.status] = (acc[t.status] ?? 0) + 1; return acc; }, {} as Record<string, number>)
  ).sort(([, a], [, b]) => b - a);

  const networkBreakdown = Object.entries(
    txns.reduce((acc, t) => { acc[t.cardNetwork] = (acc[t.cardNetwork] ?? 0) + 1; return acc; }, {} as Record<string, number>)
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-3">
        <MetricCard label="Total volume" value={formatCentsCompact(metrics.totalVolume)} sub={`${metrics.totalCount.toLocaleString()} transactions`} />
        <MetricCard label="Approval rate" value={formatPercent(metrics.approvalRate)} accent={metrics.approvalRate > 0.88 ? "green" : "red"} trend={metrics.approvalRate > 0.88 ? "up" : "down"} trendLabel={metrics.approvalRate > 0.88 ? "Above 88% target" : "Below target"} />
        <MetricCard label="Chargeback rate" value={formatPercent(metrics.chargebackRate, 2)} accent={metrics.chargebackRate > 0.01 ? "red" : undefined} />
        <MetricCard label="Pending settlement" value={formatCentsCompact(metrics.pendingSettlement)} sub="Auth + captured + clearing" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 bg-white border border-gray-200 rounded p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Volume by hour ($)</p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={volumeData}>
              <defs>
                <linearGradient id="vg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#111827" stopOpacity={0.08} />
                  <stop offset="95%" stopColor="#111827" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#9ca3af" }} />
              <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}K`} />
              <Tooltip formatter={(v) => [`$${Number(v).toLocaleString()}`, "Volume"]} contentStyle={{ fontSize: 11, border: "1px solid #e5e7eb" }} />
              <Area type="monotone" dataKey="amount" stroke="#111827" strokeWidth={1.5} fill="url(#vg)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-gray-200 rounded p-4 space-y-4">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">By status</p>
            <div className="space-y-1">
              {statusBreakdown.map(([status, count]) => (
                <div key={status} className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 capitalize">{status}</span>
                  <span className="font-medium text-gray-900 tabular-nums">{count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">By network</p>
            <div className="space-y-1">
              {networkBreakdown.map(([net, count]) => (
                <div key={net} className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">{NETWORK_LABEL[net]}</span>
                  <span className="font-medium text-gray-900 tabular-nums">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-gray-200 rounded p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Decline reasons</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={declineData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: "#9ca3af" }} />
              <YAxis dataKey="reason" type="category" tick={{ fontSize: 10, fill: "#6b7280" }} width={130} />
              <Tooltip contentStyle={{ fontSize: 11, border: "1px solid #e5e7eb" }} />
              <Bar dataKey="count" fill="#374151" radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-gray-200 rounded p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Fee breakdown</p>
          <div className="space-y-2 mb-4">
            {[
              { label: "Interchange fees",  value: formatCentsCompact(metrics.totalFees * 0.78) },
              { label: "Scheme fees",       value: formatCentsCompact(metrics.totalFees * 0.08) },
              { label: "Processing fees",   value: formatCentsCompact(metrics.totalFees * 0.14) },
            ].map((f) => (
              <div key={f.label} className="flex justify-between text-xs">
                <span className="text-gray-500">{f.label}</span>
                <span className="font-medium text-gray-900">{f.value}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-200 pt-3 flex justify-between text-xs">
            <span className="text-gray-500">Net revenue after fees</span>
            <span className="font-semibold text-green-700">{formatCentsCompact(metrics.netRevenue)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TransactionsTab({ txns }: { txns: CardTransaction[] }) {
  const [selected, setSelected] = useState<CardTransaction | null>(null);
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? txns : txns.filter((t) => t.status === filter);

  return (
    <div className="flex gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex gap-2 mb-3 flex-wrap">
          {["all", "settled", "authorized", "clearing", "declined", "chargeback", "refunded"].map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={clsx("px-2.5 py-1 text-xs rounded border transition-colors",
                filter === s ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
              )}>
              {s === "all" ? "All" : CARD_STATUS_LABEL[s as keyof typeof CARD_STATUS_LABEL]}
            </button>
          ))}
        </div>
        <div className="bg-white border border-gray-200 rounded overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {["ID", "Merchant", "Amount", "Network", "Status", "Created"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left font-medium text-gray-400 uppercase tracking-wider text-[10px]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 60).map((t) => (
                <tr key={t.id} onClick={() => setSelected(t)}
                  className={clsx("border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors",
                    selected?.id === t.id && "bg-blue-50"
                  )}>
                  <td className="px-3 py-2 font-mono text-gray-400">{t.id}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-900">{t.merchantName}</div>
                    <div className="text-gray-400">{t.merchantCategory}</div>
                  </td>
                  <td className="px-3 py-2 font-semibold text-gray-900 tabular-nums">{formatCents(t.amount)}</td>
                  <td className="px-3 py-2 text-gray-500">{NETWORK_LABEL[t.cardNetwork]}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={t.status} type="card" label={CARD_STATUS_LABEL[t.status]} size="sm" />
                  </td>
                  <td className="px-3 py-2 text-gray-400">{timeAgo(t.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="w-72 shrink-0">
          <div className="bg-white border border-gray-200 rounded p-4 sticky top-4 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-gray-900">{selected.merchantName}</p>
                <p className="text-xs text-gray-400 mt-0.5 font-mono">{selected.id}</p>
              </div>
              <StatusBadge status={selected.status} type="card" label={CARD_STATUS_LABEL[selected.status]} />
            </div>
            <p className="text-xl font-semibold text-gray-900 tabular-nums">{formatCents(selected.amount)}</p>
            {selected.declineReason && (
              <div className="bg-red-50 border border-red-100 rounded p-2">
                <p className="text-xs font-medium text-red-600">{DECLINE_REASON_LABEL[selected.declineReason]}</p>
              </div>
            )}
            <div className="space-y-1.5">
              {[
                ["Network", NETWORK_LABEL[selected.cardNetwork]],
                ["Issuer", selected.issuingBank],
                ["Acquirer", selected.acquiringBank],
                ["Auth code", selected.authCode ?? "—"],
                ["RRN", selected.rrn ?? "—"],
                ["Card present", selected.isCardPresent ? "Yes" : "No"],
                ["3-D Secure", selected.is3DSecure ? "Yes" : "No"],
                ["International", selected.isInternational ? "Yes" : "No"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs">
                  <span className="text-gray-400">{k}</span>
                  <span className="font-medium text-gray-700">{v}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 pt-3 space-y-1.5">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Fees</p>
              {[
                ["Gross", formatCents(selected.amount)],
                ["Interchange", `−${formatCents(selected.interchangeFee)}`],
                ["Scheme", `−${formatCents(selected.schemeFee)}`],
                ["Processing", `−${formatCents(selected.processingFee)}`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs">
                  <span className="text-gray-400">{k}</span>
                  <span className="text-gray-700">{v}</span>
                </div>
              ))}
              <div className="flex justify-between text-xs border-t border-gray-100 pt-1.5">
                <span className="font-medium text-gray-700">Net settlement</span>
                <span className="font-semibold text-green-700">{formatCents(selected.netSettlement)}</span>
              </div>
            </div>
            <div className="border-t border-gray-100 pt-3 space-y-1.5">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Timeline</p>
              {[
                ["Created", selected.createdAt], ["Authorized", selected.authorizedAt],
                ["Captured", selected.capturedAt], ["Cleared", selected.clearedAt], ["Settled", selected.settledAt],
              ].map(([label, ts]) => (
                <div key={label} className="flex justify-between text-xs">
                  <span className={ts ? "text-gray-400" : "text-gray-200"}>{label}</span>
                  <span className={ts ? "text-gray-700" : "text-gray-200"}>{ts ? formatDateTime(ts) : "—"}</span>
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
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Open cases", value: chargebacks.filter(c => !["won","lost"].includes(c.status)).length },
          { label: "Won",        value: chargebacks.filter(c => c.status === "won").length },
          { label: "Lost",       value: chargebacks.filter(c => c.status === "lost").length },
        ].map((m) => (
          <div key={m.label} className="bg-white border border-gray-200 rounded p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider">{m.label}</p>
            <p className="mt-1 text-xl font-semibold text-gray-900 tabular-nums">{m.value}</p>
          </div>
        ))}
      </div>
      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {["Case ID", "Transaction", "Amount", "Reason", "Status", "Deadline"].map((h) => (
                <th key={h} className="px-3 py-2.5 text-left font-medium text-gray-400 uppercase tracking-wider text-[10px]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chargebacks.map((cb) => (
              <tr key={cb.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-gray-400">{cb.id}</td>
                <td className="px-3 py-2 font-mono text-gray-400">{cb.transactionId}</td>
                <td className="px-3 py-2 font-semibold text-gray-900 tabular-nums">{formatCents(cb.amount)}</td>
                <td className="px-3 py-2 text-gray-600 capitalize">{cb.reason.replace(/_/g, " ")}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={cb.status} type="chargeback" label={CHARGEBACK_STATUS_LABEL[cb.status]} size="sm" />
                </td>
                <td className="px-3 py-2 text-gray-400">{formatDate(cb.deadlineAt)}</td>
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
    <div className="bg-white border border-gray-200 rounded overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            {["Batch", "Date", "Transactions", "Gross", "Fees", "Net", "Processor", "Status"].map((h) => (
              <th key={h} className="px-3 py-2.5 text-left font-medium text-gray-400 uppercase tracking-wider text-[10px]">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {batches.map((b) => (
            <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50">
              <td className="px-3 py-2 font-mono text-gray-400">{b.id}</td>
              <td className="px-3 py-2 text-gray-700">{formatDate(b.date)}</td>
              <td className="px-3 py-2 text-gray-700 tabular-nums">{b.transactionCount.toLocaleString()}</td>
              <td className="px-3 py-2 font-semibold text-gray-900 tabular-nums">{formatCentsCompact(b.grossAmount)}</td>
              <td className="px-3 py-2 text-red-600 tabular-nums">−{formatCentsCompact(b.totalFees)}</td>
              <td className="px-3 py-2 font-semibold text-green-700 tabular-nums">{formatCentsCompact(b.netAmount)}</td>
              <td className="px-3 py-2 text-gray-500">{b.processor}</td>
              <td className="px-3 py-2">
                <StatusBadge status={b.status} type="settlement" label={SETTLEMENT_STATUS_LABEL[b.status]} size="sm" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CardPage() {
  const [tab, setTab] = useState<Tab>("Overview");
  const [txns, setTxns] = useState<CardTransaction[]>([]);
  const [chargebacks, setChargebacks] = useState<Chargeback[]>([]);
  const [batches, setBatches] = useState<SettlementBatch[]>([]);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      const t = generateTransactions(150, DEFAULT_CONFIG);
      setTxns(t);
      setChargebacks(generateChargebacks(t));
      setBatches(generateSettlementBatches());
      setLastRefresh(new Date());
      setRefreshing(false);
    }, 400);
  }, []);

  useEffect(() => { refresh(); const id = setInterval(refresh, 30_000); return () => clearInterval(id); }, [refresh]);

  return (
    <div className="px-8 py-8 max-w-7xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Card Payments</h1>
          <p className="text-xs text-gray-400 mt-0.5">Authorization → Capture → Clearing → Settlement → Reconciliation</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">{lastRefresh.toLocaleTimeString()}</span>
          <button onClick={refresh} disabled={refreshing}
            className="flex items-center gap-1.5 bg-white border border-gray-200 rounded px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            <RefreshCw className={clsx("h-3 w-3", refreshing && "animate-spin")} /> Refresh
          </button>
        </div>
      </div>

      <div className="flex gap-0 mb-5 border-b border-gray-200">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={clsx("px-4 py-2 text-xs font-medium border-b-2 -mb-px transition-colors",
              tab === t ? "border-gray-900 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-600"
            )}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview"     && <OverviewTab     txns={txns} />}
      {tab === "Transactions" && <TransactionsTab txns={txns} />}
      {tab === "Chargebacks"  && <ChargebacksTab  chargebacks={chargebacks} />}
      {tab === "Settlement"   && <SettlementTab   batches={batches} />}
      {tab === "Lifecycle"    && <CardLifecycle />}
    </div>
  );
}
