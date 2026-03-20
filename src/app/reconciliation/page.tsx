"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, LineChart, Line,
} from "recharts";
import { BarChart3, RefreshCw, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import clsx from "clsx";

import {
  generateReconRecords, generateReconBatches,
  generateLedgerEntries, calcReconMetrics,
} from "@/lib/simulation/recon-engine";
import {
  formatCents, formatCentsCompact, formatPercent,
  formatDate, formatDateTime, timeAgo,
} from "@/lib/data/formatters";
import { ReconRecord, ReconBatch, LedgerEntry } from "@/types/payments";
import MetricCard from "@/components/ui/MetricCard";

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = ["Overview", "Break analysis", "Ledger", "Batches", "Concepts"] as const;
type Tab = typeof TABS[number];

const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  matched:           { label: "Matched",            color: "text-green-700",  bg: "bg-green-50",   border: "border-green-200" },
  unmatched:         { label: "Unmatched",           color: "text-red-700",    bg: "bg-red-50",     border: "border-red-200" },
  mismatched_amount: { label: "Amount mismatch",     color: "text-orange-700", bg: "bg-gray-50",  border: "border-gray-200" },
  duplicate:         { label: "Duplicate",           color: "text-purple-700", bg: "bg-gray-50",  border: "border-gray-200" },
  timing_difference: { label: "Timing difference",   color: "text-blue-700",   bg: "bg-gray-50",    border: "border-gray-200" },
  missing_in_bank:   { label: "Missing in bank",     color: "text-rose-700",   bg: "bg-gray-50",    border: "border-gray-200" },
  missing_in_ledger: { label: "Missing in ledger",   color: "text-amber-700",  bg: "bg-gray-50",   border: "border-gray-200" },
};

function StatusPill({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: status, color: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200" };
  return (
    <span className={clsx("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium", m.bg, m.border, m.color)}>
      {m.label}
    </span>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function OverviewTab({ records, batches }: { records: ReconRecord[]; batches: ReconBatch[] }) {
  const metrics = calcReconMetrics(records);

  const statusData = Object.entries(
    records.reduce((acc, r) => { acc[r.status] = (acc[r.status] ?? 0) + 1; return acc; }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name: STATUS_META[name]?.label ?? name, value, status: name }));

  const STATUS_COLORS: Record<string, string> = {
    matched: "#22c55e", unmatched: "#ef4444", mismatched_amount: "#f97316",
    duplicate: "#a855f7", timing_difference: "#3b82f6",
    missing_in_bank: "#f43f5e", missing_in_ledger: "#f59e0b",
  };

  const batchTrend = [...batches].reverse().map(b => ({
    date:      b.date.slice(5),
    matchRate: Math.round((b.matchedCount / b.totalRecords) * 100),
    breaks:    b.unmatchedCount + b.mismatchedCount,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <MetricCard label="Match rate"         value={formatPercent(metrics.matchRate)}             sub={`${metrics.totalRecords} total records`}   accent={metrics.matchRate > 0.95 ? "green" : "yellow"} trend={metrics.matchRate > 0.95 ? "up" : "down"} trendLabel={metrics.matchRate > 0.95 ? "Above 95% target" : "Below target"} />
        <MetricCard label="Open breaks"        value={String(metrics.openBreaks)}                   sub="Unresolved discrepancies"                  accent={metrics.openBreaks > 10 ? "red" : "green"} />
        <MetricCard label="Total discrepancy"  value={formatCentsCompact(metrics.totalDiscrepancy)} sub="Sum of all mismatched amounts"              accent="red" />
        <MetricCard label="Avg resolution"     value={`${metrics.avgResolutionHours}h`}             sub="Time to resolve a break"                   accent="purple" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Records by status</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={statusData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#94a3b8" }} interval={0} angle={-20} textAnchor="end" height={40} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <Tooltip />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {statusData.map((d) => <Cell key={d.status} fill={STATUS_COLORS[d.status] ?? "#94a3b8"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Match rate trend (7 days)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={batchTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} domain={[80, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v) => [`${Number(v)}%`, "Match rate"]} />
              <Line type="monotone" dataKey="matchRate" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3-way reconciliation explainer */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 mb-1">Three-way reconciliation</h3>
        <p className="text-xs text-slate-400 mb-4">Every record must match across three independent sources</p>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Internal ledger",     icon: "📒", desc: "Your system's record of every transaction. Source of truth for what you believe happened.", color: "border-gray-200 bg-gray-50" },
            { label: "Processor file",      icon: "📄", desc: "The settlement file from your processor (Stripe, Adyen, etc). Contains their view of captured and settled transactions.", color: "border-gray-200 bg-gray-50" },
            { label: "Bank statement",      icon: "🏦", desc: "The actual bank account statement. Shows real fund movements. The ultimate source of financial truth.", color: "border-green-200 bg-green-50" },
          ].map((s) => (
            <div key={s.label} className={clsx("rounded-xl border p-4", s.color)}>
              <div className="text-2xl mb-2">{s.icon}</div>
              <p className="text-sm font-semibold text-slate-900">{s.label}</p>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-lg bg-slate-900 p-4">
          <p className="text-xs text-slate-300 leading-relaxed">
            A transaction is only fully reconciled when all three sources agree on the same amount, currency, reference, and date. Any discrepancy — even $0.01 — is a break that must be investigated. Breaks can indicate fraud, system bugs, timing issues, or fee miscalculations.
          </p>
        </div>
      </div>
    </div>
  );
}

function BreakAnalysisTab({ records }: { records: ReconRecord[] }) {
  const [selected, setSelected] = useState<ReconRecord | null>(null);
  const [filter,   setFilter]   = useState("all");

  const breaks = records.filter(r => r.status !== "matched");
  const filtered = filter === "all" ? breaks : breaks.filter(r => r.status === filter);

  return (
    <div className="flex gap-5">
      <div className="flex-1 min-w-0 space-y-4">
        <div className="flex gap-2 flex-wrap">
          {["all", "unmatched", "mismatched_amount", "duplicate", "timing_difference", "missing_in_bank", "missing_in_ledger"].map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={clsx("rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                filter === f ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
              )}>
              {f === "all" ? `All breaks (${breaks.length})` : STATUS_META[f]?.label ?? f}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {["ID", "Merchant", "Ledger", "Processor", "Bank", "Discrepancy", "Status", "Resolved"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} onClick={() => setSelected(r)}
                  className={clsx("border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors",
                    selected?.id === r.id && "bg-gray-50"
                  )}>
                  <td className="px-4 py-2.5 font-mono text-slate-400">{r.id}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-900">{r.merchantName}</td>
                  <td className="px-4 py-2.5 text-slate-700">{r.ledgerAmount > 0 ? formatCents(r.ledgerAmount) : <span className="text-slate-300">—</span>}</td>
                  <td className="px-4 py-2.5 text-slate-700">{r.processorAmount > 0 ? formatCents(r.processorAmount) : <span className="text-slate-300">—</span>}</td>
                  <td className="px-4 py-2.5 text-slate-700">{r.bankAmount > 0 ? formatCents(r.bankAmount) : <span className="text-slate-300">—</span>}</td>
                  <td className="px-4 py-2.5 font-semibold text-red-600">
                    {r.discrepancy > 0 ? formatCents(r.discrepancy) : "—"}
                  </td>
                  <td className="px-4 py-2.5"><StatusPill status={r.status} /></td>
                  <td className="px-4 py-2.5">
                    {r.resolvedAt
                      ? <span className="text-green-600 font-medium">✓ Resolved</span>
                      : <span className="text-red-500 font-medium">⚠ Open</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="w-80 shrink-0">
          <div className={clsx("rounded-xl border-2 p-5 sticky top-4 space-y-4 shadow-sm",
            STATUS_META[selected.status]?.bg ?? "bg-white",
            STATUS_META[selected.status]?.border ?? "border-slate-200"
          )}>
            <div>
              <p className="font-semibold text-slate-900">{selected.merchantName}</p>
              <p className="text-xs text-slate-400 mt-0.5">{selected.id}</p>
              <div className="mt-2"><StatusPill status={selected.status} /></div>
            </div>

            {/* Three-way comparison */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Three-way comparison</p>
              {[
                { source: "Internal ledger",  amount: selected.ledgerAmount,    icon: "📒" },
                { source: "Processor file",   amount: selected.processorAmount, icon: "📄" },
                { source: "Bank statement",   amount: selected.bankAmount,      icon: "🏦" },
              ].map(({ source, amount, icon }) => {
                const allAmounts = [selected.ledgerAmount, selected.processorAmount, selected.bankAmount].filter(a => a > 0);
                const isMax = allAmounts.length > 0 && amount === Math.max(...allAmounts);
                const isMin = allAmounts.length > 0 && amount === Math.min(...allAmounts) && new Set(allAmounts).size > 1;
                return (
                  <div key={source} className={clsx("flex items-center justify-between rounded-lg p-2.5",
                    amount === 0 ? "bg-red-50 border border-red-100" : "bg-white border border-slate-100"
                  )}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{icon}</span>
                      <span className="text-xs text-slate-600">{source}</span>
                    </div>
                    <span className={clsx("text-xs font-semibold",
                      amount === 0 ? "text-red-400" :
                      isMax ? "text-orange-600" :
                      isMin ? "text-blue-600" :
                      "text-slate-900"
                    )}>
                      {amount > 0 ? formatCents(amount) : "Missing"}
                    </span>
                  </div>
                );
              })}
            </div>

            {selected.discrepancy > 0 && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                <p className="text-xs font-semibold text-red-700">Discrepancy: {formatCents(selected.discrepancy)}</p>
              </div>
            )}

            <div className="space-y-1.5">
              {[
                ["Transaction",   selected.transactionId],
                ["Processor ref", selected.processorRef],
                ["Bank ref",      selected.bankRef],
                ["Date",          selected.date],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs">
                  <span className="text-slate-400">{k}</span>
                  <span className="font-medium text-slate-700 text-right truncate max-w-[160px]">{v}</span>
                </div>
              ))}
            </div>

            {selected.resolvedAt ? (
              <div className="rounded-lg bg-green-50 border border-green-200 p-3 space-y-1">
                <p className="text-xs font-semibold text-green-700 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" /> Resolved
                </p>
                <p className="text-xs text-green-600">{selected.resolutionNote}</p>
                <p className="text-xs text-green-500">By {selected.resolvedBy} · {timeAgo(selected.resolvedAt)}</p>
              </div>
            ) : (
              <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
                <p className="text-xs font-semibold text-amber-700 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Open break — needs investigation
                </p>
                <p className="text-xs text-amber-600 mt-0.5 leading-relaxed">
                  This discrepancy has not been resolved. It will affect the daily reconciliation report.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function LedgerTab({ entries }: { entries: LedgerEntry[] }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs text-slate-500 leading-relaxed">
          Double-entry bookkeeping underlies every payment system. Every transaction creates at least two
          ledger entries — a debit and a credit — that must always balance. The running balance shows
          the current position of each account. Unreconciled entries (highlighted) have not yet been
          matched to a bank statement or processor file.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              {["Entry ID", "Account", "Description", "Type", "Amount", "Running balance", "Reconciled"].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className={clsx("border-b border-slate-50 hover:bg-slate-50",
                !e.isReconciled && "bg-gray-50"
              )}>
                <td className="px-4 py-2.5 font-mono text-slate-400">{e.id}</td>
                <td className="px-4 py-2.5 text-slate-700">{e.accountName}</td>
                <td className="px-4 py-2.5 text-slate-600">{e.description}</td>
                <td className="px-4 py-2.5">
                  <span className={clsx("rounded-full px-2 py-0.5 text-xs font-medium",
                    e.entryType === "credit" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  )}>
                    {e.entryType}
                  </span>
                </td>
                <td className={clsx("px-4 py-2.5 font-semibold",
                  e.entryType === "credit" ? "text-green-600" : "text-red-600"
                )}>
                  {e.entryType === "credit" ? "+" : "−"}{formatCents(e.amount)}
                </td>
                <td className="px-4 py-2.5 font-semibold text-slate-900">{formatCentsCompact(e.balance)}</td>
                <td className="px-4 py-2.5">
                  {e.isReconciled
                    ? <span className="text-green-600 text-xs font-medium">✓ Reconciled</span>
                    : <span className="text-amber-600 text-xs font-medium">⚠ Pending</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BatchesTab({ batches }: { batches: ReconBatch[] }) {
  const STATUS_COLORS: Record<string, string> = {
    complete:     "bg-green-100 text-green-700",
    running:      "bg-gray-50 text-blue-700",
    needs_review: "bg-red-100 text-red-700",
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              {["Batch", "Date", "Total", "Matched", "Unmatched", "Mismatched", "Duplicates", "Timing", "Discrepancy", "Status"].map((h) => (
                <th key={h} className="px-3 py-3 text-left font-medium text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.id} className={clsx("border-b border-slate-50 hover:bg-slate-50",
                b.status === "needs_review" && "bg-red-50"
              )}>
                <td className="px-3 py-2.5 font-mono text-slate-400">{b.id}</td>
                <td className="px-3 py-2.5 text-slate-700">{formatDate(b.date)}</td>
                <td className="px-3 py-2.5 font-semibold text-slate-900">{b.totalRecords.toLocaleString()}</td>
                <td className="px-3 py-2.5 text-green-600 font-medium">{b.matchedCount.toLocaleString()}</td>
                <td className={clsx("px-3 py-2.5 font-medium", b.unmatchedCount > 0 ? "text-red-600" : "text-slate-300")}>
                  {b.unmatchedCount}
                </td>
                <td className={clsx("px-3 py-2.5 font-medium", b.mismatchedCount > 0 ? "text-orange-600" : "text-slate-300")}>
                  {b.mismatchedCount}
                </td>
                <td className={clsx("px-3 py-2.5 font-medium", b.duplicateCount > 0 ? "text-purple-600" : "text-slate-300")}>
                  {b.duplicateCount}
                </td>
                <td className={clsx("px-3 py-2.5 font-medium", b.timingCount > 0 ? "text-blue-600" : "text-slate-300")}>
                  {b.timingCount}
                </td>
                <td className={clsx("px-3 py-2.5 font-semibold", b.totalDiscrepancy > 0 ? "text-red-600" : "text-slate-300")}>
                  {b.totalDiscrepancy > 0 ? formatCentsCompact(b.totalDiscrepancy) : "—"}
                </td>
                <td className="px-3 py-2.5">
                  <span className={clsx("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_COLORS[b.status])}>
                    {b.status.replace("_", " ")}
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

function ConceptsTab() {
  const concepts = [
    {
      title: "What reconciliation actually is",
      color: "border-l-gray-300",
      body: "Reconciliation is the process of confirming that your internal records match external sources. In payments: your ledger must match the processor's settlement file, which must match your bank statement. If all three agree — reconciled. If not — you have a break.",
    },
    {
      title: "Why it matters",
      color: "border-l-red-500",
      body: "A payment system that processes millions of transactions but can't reconcile them is dangerous. Breaks can mean: funds lost in transit, fraud not detected, double-payouts, fee errors, or regulatory violations. Finance teams cannot close their books without clean reconciliation.",
    },
    {
      title: "Break types",
      color: "border-l-gray-300",
      body: "Unmatched: in one source but not the other. Mismatched amount: present in both but different amounts. Timing difference: transaction crossed a cut-off window — will match tomorrow. Duplicate: same transaction recorded twice. Missing in bank: paid out but bank hasn't received it yet.",
    },
    {
      title: "Ledger drift",
      color: "border-l-gray-300",
      body: "When your internal ledger gradually diverges from reality due to accumulated small errors. A $0.01 rounding error on 10 million transactions = $100,000 discrepancy. Ledger drift is often caused by async processing, retry bugs, or timezone mishandling. It compounds over time and is very hard to reverse-engineer.",
    },
    {
      title: "Idempotency in reconciliation",
      color: "border-l-gray-300",
      body: "Every payment operation must be idempotent — if a webhook fires twice, the ledger should only post once. Idempotency keys prevent duplicate entries. Without them, a retry storm (common during outages) creates duplicate ledger entries that are almost impossible to unwind at scale.",
    },
    {
      title: "Float and timing",
      color: "border-l-green-500",
      body: "A payment can be 'successful' (card auth returned approved) while funds are still in transit (not yet settled). The window between authorization and settlement is float — the payment processor holds these funds. A merchant's 'available balance' differs from their 'settled balance' during this window.",
    },
    {
      title: "Cut-off windows",
      color: "border-l-gray-300",
      body: "Settlement happens in batches with strict cut-off times. A transaction captured at 11:59pm may settle in today's batch; the same transaction at 12:01am is tomorrow's. This creates systematic timing differences that a reconciliation system must understand — they're not errors, they're expected.",
    },
    {
      title: "Exception handling",
      color: "border-l-gray-300",
      body: "Every reconciliation system needs an exception queue — a place for breaks to sit while being investigated. Exceptions need SLAs (e.g. all >$1,000 breaks resolved within 24h), ownership (which team investigates), and an audit trail of every action taken. Unmanaged exceptions compound into larger problems.",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      {concepts.map((c) => (
        <div key={c.title} className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm border-l-4 ${c.color}`}>
          <h3 className="text-sm font-semibold text-slate-900 mb-2">{c.title}</h3>
          <p className="text-xs text-slate-600 leading-relaxed">{c.body}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReconPage() {
  const [tab,        setTab]        = useState<Tab>("Overview");
  const [records,    setRecords]    = useState<ReconRecord[]>([]);
  const [batches,    setBatches]    = useState<ReconBatch[]>([]);
  const [entries,    setEntries]    = useState<LedgerEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh,setLastRefresh]= useState(new Date());

  const refresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRecords(generateReconRecords(120));
      setBatches(generateReconBatches());
      setEntries(generateLedgerEntries());
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
            <BarChart3 className="h-5 w-5 text-green-600" />
            <h1 className="text-xl font-semibold text-slate-900">Reconciliation & Ops</h1>
            <span className="relative flex h-2 w-2 ml-1">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
          </div>
          <p className="text-xs text-slate-400">Three-way reconciliation · Break analysis · Ledger entries · Settlement batches · Idempotency</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">Updated {lastRefresh.toLocaleTimeString()}</span>
          <button onClick={refresh} disabled={refreshing}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 shadow-sm disabled:opacity-50">
            <RefreshCw className={clsx("h-3.5 w-3.5", refreshing && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={clsx("px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === t ? "border-gray-900 text-gray-900" : "border-transparent text-slate-500 hover:text-slate-700"
            )}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview"       && <OverviewTab      records={records} batches={batches} />}
      {tab === "Break analysis" && <BreakAnalysisTab records={records} />}
      {tab === "Ledger"         && <LedgerTab        entries={entries} />}
      {tab === "Batches"        && <BatchesTab       batches={batches} />}
      {tab === "Concepts"       && <ConceptsTab />}
    </div>
  );
}
