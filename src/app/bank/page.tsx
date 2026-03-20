"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Building2, RefreshCw, AlertTriangle } from "lucide-react";
import clsx from "clsx";

import { generateBankTransfers, generateACHBatches, calcBankMetrics } from "@/lib/simulation/bank-engine";
import {
  formatCents, formatCentsCompact, formatPercent,
  formatDateTime, formatDate, timeAgo,
  BANK_STATUS_LABEL, BANK_TYPE_LABEL, BANK_STATUS_COLORS,
} from "@/lib/data/formatters";
import { BankTransfer, ACHBatch } from "@/types/payments";
import MetricCard from "@/components/ui/MetricCard";

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = ["Overview", "Transfers", "ACH Batches", "Returns", "Lifecycle"] as const;
type Tab = typeof TABS[number];

const TYPE_COLORS: Record<string, string> = {
  ach_credit:  "#3b82f6",
  ach_debit:   "#8b5cf6",
  wire:        "#f59e0b",
  rtp:         "#10b981",
  sepa_credit: "#6366f1",
  sepa_debit:  "#ec4899",
};

// ─── Rail comparison data ─────────────────────────────────────────────────────

const RAILS = [
  {
    id: "ach_credit",
    name: "ACH Credit",
    speed: "T+1 / T+3",
    reversible: "Limited",
    limit: "$25M+",
    use: "Payroll, vendor payments",
    risk: "Low",
    pull: false,
    realtime: false,
    color: "border-blue-200 bg-blue-50",
    badge: "bg-blue-100 text-blue-700",
  },
  {
    id: "ach_debit",
    name: "ACH Debit",
    speed: "T+2 / T+4",
    reversible: "Yes — up to 60 days",
    limit: "$25M+",
    use: "Bill pay, subscriptions",
    risk: "Medium — unauthorized returns",
    pull: true,
    realtime: false,
    color: "border-purple-200 bg-purple-50",
    badge: "bg-purple-100 text-purple-700",
  },
  {
    id: "wire",
    name: "Wire Transfer",
    speed: "Same day (hours)",
    reversible: "Irrevocable",
    limit: "Unlimited",
    use: "High-value B2B, real estate",
    risk: "High — fraud irrecoverable",
    pull: false,
    realtime: false,
    color: "border-amber-200 bg-amber-50",
    badge: "bg-amber-100 text-amber-700",
  },
  {
    id: "rtp",
    name: "Real-Time Payment",
    speed: "Seconds (24/7)",
    reversible: "No",
    limit: "$1M",
    use: "Consumer P2P, instant payout",
    risk: "High — immediate, no recall",
    pull: false,
    realtime: true,
    color: "border-green-200 bg-green-50",
    badge: "bg-green-100 text-green-700",
  },
  {
    id: "sepa_credit",
    name: "SEPA Credit",
    speed: "T+1 (EU)",
    reversible: "Limited",
    limit: "€999,999,999",
    use: "EU vendor payments, salaries",
    risk: "Low",
    pull: false,
    realtime: false,
    color: "border-indigo-200 bg-indigo-50",
    badge: "bg-indigo-100 text-indigo-700",
  },
];

// ─── Bank lifecycle stages ────────────────────────────────────────────────────

const BANK_STAGES = [
  {
    id: "initiation",
    label: "1. Initiation",
    timing: "T+0",
    color: "text-slate-700",
    bg: "bg-slate-50",
    border: "border-slate-300",
    description: "The originator (sender) creates a payment instruction with ODFI (Originating Depository Financial Institution). For ACH, the instruction is batched with others — ACH is not a per-transaction system.",
    technical: [
      "NACHA file format: fixed-width flat file",
      "Batch header: company name, entry description, effective date",
      "Detail record: routing number, account number, amount, trace",
      "Addenda record: additional payment info (optional)",
      "Prenote: zero-dollar test entry for new accounts",
    ],
    keyDiff: "Unlike cards, there is no real-time authorization. The originator simply instructs — the receiver's bank may reject later.",
  },
  {
    id: "submission",
    label: "2. Submission to ACH",
    timing: "T+0 (cut-off)",
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
    description: "The ODFI submits the NACHA file to the ACH operator (Fed ACH or EPN) before the cut-off window. Standard ACH has multiple daily windows. Same-Day ACH has earlier cut-offs with premium pricing.",
    technical: [
      "Fed ACH cut-off times: 10:30am, 2:45pm, 5:00pm ET",
      "Same-Day ACH cut-off: 2:45pm ET (settles same day 5pm)",
      "File format: NACHA CCD, PPD, CTX, TEL, WEB",
      "Batch balancing: total debits must equal total credits (or net)",
      "File validation: routing numbers, account format, batch totals",
    ],
    keyDiff: "Missing a cut-off window means waiting for the next batch — minimum T+1 delay. Card auth happens in seconds regardless of time of day.",
  },
  {
    id: "processing",
    label: "3. ACH Operator Processing",
    timing: "T+0 to T+1",
    color: "text-purple-700",
    bg: "bg-purple-50",
    border: "border-purple-200",
    description: "The ACH operator sorts and distributes entries to RDFIs (Receiving Depository Financial Institutions). The RDFI has until settlement to post the entry or return it.",
    technical: [
      "ACH operator: Federal Reserve (FedACH) or EPN (The Clearing House)",
      "RDFI receives file: must post or initiate return",
      "RDFI has 2 banking days to return most entries",
      "R06 (returned per ODFI request): ODFI can recall within 5 days",
      "No real-time visibility into RDFI processing",
    ],
    keyDiff: "There is no approval or decline at this stage — unlike card auth. The ODFI only learns of problems after the fact via return entries.",
  },
  {
    id: "settlement",
    label: "4. Settlement",
    timing: "T+1 to T+3",
    color: "text-green-700",
    bg: "bg-green-50",
    border: "border-green-200",
    description: "The Fed nets all ACH positions and settles via Fedwire. Settlement is final for credits — the receiver's account is credited. For debits, the originator's account is debited. Money actually moves here.",
    technical: [
      "Settlement via Federal Reserve master accounts",
      "Net settlement: Fed nets ODFI/RDFI positions",
      "Credit entries: RDFI must make funds available by settlement",
      "Debit entries: ODFI provisionally credited — reversible until return window closes",
      "Same-Day ACH settles 5:00pm ET same day",
    ],
    keyDiff: "ACH debit settlement is provisional — funds can be clawed back via return entries for up to 60 days in some cases. Wire settlement is final and irrevocable.",
  },
  {
    id: "returns",
    label: "5. Returns",
    timing: "T+1 to T+60",
    color: "text-rose-700",
    bg: "bg-rose-50",
    border: "border-rose-200",
    description: "The RDFI returns an entry by sending a return entry to the ODFI. Returns have standardized reason codes (R01–R85). The return window varies: 2 banking days for most, 60 days for unauthorized debits.",
    technical: [
      "Return entry: same format as original with R-code addenda",
      "Standard return window: 2 banking days",
      "Unauthorized return window: 60 calendar days (R05, R07, R10, R29)",
      "Dishonored returns: ODFI can dishonor an improper return",
      "Return rate threshold: NACHA limits > 0.5% (admin) or 3% (unauthorized)",
    ],
    keyDiff: "Card chargebacks have a 120-day window but require cardholder action. ACH unauthorized debits can be returned for 60 days automatically by the RDFI — no cardholder dispute needed.",
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const colors = BANK_STATUS_COLORS[status] ?? "bg-slate-100 text-slate-600 border-slate-200";
  const isLive = ["submitted", "pending_settlement"].includes(status);
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", colors)}>
      {isLive && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-current" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current" />
        </span>
      )}
      {BANK_STATUS_LABEL[status] ?? status}
    </span>
  );
}

function OverviewTab({ transfers }: { transfers: BankTransfer[] }) {
  const metrics = calcBankMetrics(transfers);

  const byType = Object.entries(
    transfers.reduce((acc, t) => {
      acc[t.type] = (acc[t.type] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name: BANK_TYPE_LABEL[name] ?? name, value, id: name }));

  const byStatus = Object.entries(
    transfers.reduce((acc, t) => {
      acc[t.status] = (acc[t.status] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name: BANK_STATUS_LABEL[name] ?? name, value }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <MetricCard label="Total volume"        value={formatCentsCompact(metrics.totalVolume)}      sub={`${metrics.totalCount} transfers`}           accent="blue" />
        <MetricCard label="Return rate"         value={formatPercent(metrics.returnRate, 2)}         sub="Returned / total"                            accent={metrics.returnRate > 0.005 ? "red" : "green"} trend={metrics.returnRate > 0.005 ? "down" : "up"} trendLabel={metrics.returnRate > 0.005 ? "Above 0.5% NACHA limit" : "Within NACHA limit"} />
        <MetricCard label="Avg settlement"      value={`${metrics.avgSettlementHours}h`}             sub="From initiation to settled"                  accent="purple" />
        <MetricCard label="Pending volume"      value={formatCentsCompact(metrics.pendingVolume)}    sub="In-flight transfers"                         accent="yellow" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Transfers by rail</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byType}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <Tooltip />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {byType.map((entry) => (
                  <Cell key={entry.id} fill={TYPE_COLORS[entry.id] ?? "#94a3b8"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Transfers by status</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byStatus} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "#64748b" }} width={130} />
              <Tooltip />
              <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Rail comparison */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 mb-1">Payment rails comparison</h3>
        <p className="text-xs text-slate-400 mb-4">Key differences employers test on — reversibility, timing, and risk profile</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100">
                {["Rail", "Speed", "Reversible?", "Limit", "Use case", "Risk", "Pull?", "24/7?"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-medium text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RAILS.map((r) => (
                <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-3 py-2.5">
                    <span className={clsx("rounded-full px-2 py-0.5 text-xs font-medium", r.badge)}>{r.name}</span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-700 font-medium">{r.speed}</td>
                  <td className={clsx("px-3 py-2.5 font-medium", r.reversible.startsWith("No") || r.reversible === "Irrevocable" ? "text-red-600" : "text-amber-600")}>{r.reversible}</td>
                  <td className="px-3 py-2.5 text-slate-600">{r.limit}</td>
                  <td className="px-3 py-2.5 text-slate-600">{r.use}</td>
                  <td className={clsx("px-3 py-2.5 font-medium", r.risk.startsWith("High") ? "text-red-600" : r.risk.startsWith("Medium") ? "text-amber-600" : "text-green-600")}>{r.risk}</td>
                  <td className="px-3 py-2.5">{r.pull ? "✓" : "—"}</td>
                  <td className="px-3 py-2.5">{r.realtime ? "✓" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TransfersTab({ transfers }: { transfers: BankTransfer[] }) {
  const [selected, setSelected] = useState<BankTransfer | null>(null);
  const [filter, setFilter]     = useState("all");

  const filtered = filter === "all" ? transfers : transfers.filter((t) =>
    filter === "returned" ? t.status === "returned" : t.type === filter
  );

  return (
    <div className="flex gap-5">
      <div className="flex-1 min-w-0">
        <div className="flex gap-2 mb-4 flex-wrap">
          {["all", "ach_credit", "ach_debit", "wire", "rtp", "returned"].map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={clsx("rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                filter === f ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
              )}>
              {f === "all" ? "All" : f === "returned" ? "Returns" : BANK_TYPE_LABEL[f]}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {["ID", "From → To", "Amount", "Type", "Status", "Effective date"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 60).map((t) => (
                <tr key={t.id} onClick={() => setSelected(t)}
                  className={clsx("border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors", selected?.id === t.id && "bg-blue-50")}>
                  <td className="px-4 py-2.5 font-mono text-slate-500">{t.id}</td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-slate-900">{t.senderName}</div>
                    <div className="text-slate-400">→ {t.receiverName}</div>
                  </td>
                  <td className="px-4 py-2.5 font-semibold text-slate-900">{formatCents(t.amount, t.currency)}</td>
                  <td className="px-4 py-2.5 text-slate-600">{BANK_TYPE_LABEL[t.type]}</td>
                  <td className="px-4 py-2.5"><StatusPill status={t.status} /></td>
                  <td className="px-4 py-2.5 text-slate-400">{formatDate(t.effectiveDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="w-80 shrink-0">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5 sticky top-4 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-slate-900">{selected.senderName}</p>
                <p className="text-xs text-slate-400 mt-0.5">{selected.id}</p>
              </div>
              <StatusPill status={selected.status} />
            </div>

            <div className="text-2xl font-semibold text-slate-900">{formatCents(selected.amount, selected.currency)}</div>

            {selected.returnCode && (
              <div className="rounded-lg bg-red-50 border border-red-100 p-3">
                <p className="text-xs font-semibold text-red-700">{selected.returnCode} — {selected.returnDescription}</p>
                {selected.returnedAt && <p className="text-xs text-red-500 mt-0.5">Returned {timeAgo(selected.returnedAt)}</p>}
              </div>
            )}

            <div className="space-y-2">
              {[
                ["Rail",         BANK_TYPE_LABEL[selected.type]],
                ["Direction",    selected.type.includes("debit") ? "Pull (debit)" : "Push (credit)"],
                ["Same-Day ACH", selected.isSameDayACH ? "Yes" : "No"],
                ["Sender bank",  selected.senderBank],
                ["Receiver bank",selected.receiverBank],
                ["Trace number", selected.traceNumber ?? "—"],
                ["Description",  selected.description],
                ["Entry desc",   selected.companyEntryDescription ?? "—"],
                ["Prenote req.", selected.prenoteRequired ? "Yes" : "No"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs">
                  <span className="text-slate-400">{k}</span>
                  <span className="font-medium text-slate-700 text-right max-w-[160px]">{v}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-100 pt-3 space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Timeline</p>
              {[
                ["Initiated",   selected.createdAt],
                ["Submitted",   selected.submittedAt],
                ["Settled",     selected.settledAt],
                ["Returned",    selected.returnedAt],
              ].map(([label, ts]) => (
                <div key={label} className="flex justify-between text-xs">
                  <span className={ts ? "text-slate-400" : "text-slate-200"}>{label}</span>
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

function ACHBatchesTab({ batches }: { batches: ACHBatch[] }) {
  const STATUS_COLORS: Record<string, string> = {
    created:    "bg-slate-100 text-slate-600",
    submitted:  "bg-blue-100 text-blue-700",
    processing: "bg-yellow-100 text-yellow-700",
    settled:    "bg-green-100 text-green-700",
    returned:   "bg-red-100 text-red-700",
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs text-slate-500 leading-relaxed">
          ACH is a batch system — transactions are not processed individually. The ODFI groups
          entries into a NACHA file submitted to the ACH operator at scheduled cut-off windows.
          Each batch has a company entry description and an effective date that determines when
          the RDFI must post the entries.
        </p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              {["Batch ID", "Company", "Entry desc", "Effective date", "Count", "Total credit", "Total debit", "Returns", "Status"].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-slate-500">{b.id}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{b.companyName}</td>
                <td className="px-4 py-3 text-slate-600">{b.entryDescription}</td>
                <td className="px-4 py-3 text-slate-600">{formatDate(b.effectiveDate)}</td>
                <td className="px-4 py-3 text-slate-700">{b.transferCount}</td>
                <td className="px-4 py-3 text-green-600 font-medium">{formatCentsCompact(b.totalCredit)}</td>
                <td className="px-4 py-3 text-purple-600 font-medium">{formatCentsCompact(b.totalDebit)}</td>
                <td className={clsx("px-4 py-3 font-medium", b.returnRate > 0.005 ? "text-red-600" : "text-slate-600")}>
                  {b.returnCount} ({formatPercent(b.returnRate, 2)})
                </td>
                <td className="px-4 py-3">
                  <span className={clsx("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_COLORS[b.status])}>{b.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReturnsTab({ transfers }: { transfers: BankTransfer[] }) {
  const returns = transfers.filter((t) => t.status === "returned");

  const byCode = Object.entries(
    returns.reduce((acc, t) => {
      const k = t.returnCode ?? "unknown";
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  )
    .sort(([, a], [, b]) => b - a)
    .map(([code, count]) => ({ code, count }));

  const RETURN_CODE_DESC: Record<string, string> = {
    R01: "Insufficient funds",     R02: "Account closed",
    R03: "No account found",       R04: "Invalid account number",
    R05: "Unauthorized debit",     R07: "Authorization revoked",
    R08: "Payment stopped",        R10: "Not authorized",
    R16: "Account frozen",         R29: "Corporate not authorized",
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-l-4 border-red-500 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total returns</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{returns.length}</p>
        </div>
        <div className="rounded-xl border border-l-4 border-amber-500 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Return rate</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {formatPercent(returns.length / (transfers.length || 1), 2)}
          </p>
        </div>
        <div className="rounded-xl border border-l-4 border-rose-500 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Returned volume</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {formatCentsCompact(returns.reduce((s, t) => s + t.amount, 0))}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Returns by code</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byCode} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis dataKey="code" type="category" tick={{ fontSize: 11, fill: "#64748b" }} width={36} />
              <Tooltip />
              <Bar dataKey="count" fill="#ef4444" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Return code reference</h3>
          <div className="space-y-2 overflow-y-auto max-h-[200px]">
            {Object.entries(RETURN_CODE_DESC).map(([code, desc]) => (
              <div key={code} className="flex items-start gap-2 text-xs">
                <span className="shrink-0 rounded bg-red-50 px-1.5 py-0.5 font-mono font-semibold text-red-700">{code}</span>
                <span className="text-slate-600">{desc}</span>
                {["R05", "R07", "R10", "R29"].includes(code) && (
                  <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">60d window</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {returns.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {["Transfer ID", "Sender", "Amount", "Code", "Reason", "Returned"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {returns.map((t) => (
                <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-mono text-slate-500">{t.id}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-900">{t.senderName}</td>
                  <td className="px-4 py-2.5 font-semibold text-slate-900">{formatCents(t.amount)}</td>
                  <td className="px-4 py-2.5">
                    <span className="rounded bg-red-50 px-1.5 py-0.5 font-mono font-semibold text-red-700">{t.returnCode}</span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{t.returnDescription}</td>
                  <td className="px-4 py-2.5 text-slate-400">{t.returnedAt ? timeAgo(t.returnedAt) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LifecycleTab() {
  const [selected, setSelected] = useState(BANK_STAGES[0]);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">ACH payment lifecycle</h3>
        <p className="mt-1 text-xs text-slate-500">
          Unlike card payments, ACH has no real-time authorization. The key insight is that
          settlement is provisional for debits — funds can be reversed for up to 60 days.
        </p>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {BANK_STAGES.map((stage, i) => (
          <div key={stage.id} className="flex items-center shrink-0">
            <button onClick={() => setSelected(stage)}
              className={clsx("rounded-lg border-2 px-3 py-2.5 text-left transition-all min-w-[120px]",
                selected.id === stage.id ? `${stage.bg} ${stage.border} shadow-sm` : "bg-white border-slate-200 hover:border-slate-300"
              )}>
              <p className={clsx("text-xs font-semibold", selected.id === stage.id ? stage.color : "text-slate-700")}>{stage.label}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{stage.timing}</p>
            </button>
            {i < BANK_STAGES.length - 1 && (
              <svg width="20" height="20" viewBox="0 0 20 20" className="mx-1 shrink-0">
                <path d="M2 10 L18 10" stroke="#cbd5e1" strokeWidth="1.5" fill="none"/>
                <path d="M13 6 L18 10 L13 14" stroke="#cbd5e1" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </div>
        ))}
      </div>

      <div className={clsx("rounded-xl border-2 p-5 shadow-sm", selected.bg, selected.border)}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className={clsx("text-base font-semibold", selected.color)}>{selected.label}</h3>
            <p className="text-xs text-slate-500 mt-0.5">Timing: {selected.timing}</p>
          </div>
        </div>

        <p className="text-sm text-slate-700 leading-relaxed mb-5">{selected.description}</p>

        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 mb-5">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800 font-medium">{selected.keyDiff}</p>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Technical detail</p>
          <ul className="space-y-1.5">
            {selected.technical.map((t) => (
              <li key={t} className="flex items-start gap-2 text-xs text-slate-600">
                <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BankPage() {
  const [tab,       setTab]       = useState<Tab>("Overview");
  const [transfers, setTransfers] = useState<BankTransfer[]>([]);
  const [batches,   setBatches]   = useState<ACHBatch[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const refresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setTransfers(generateBankTransfers(100));
      setBatches(generateACHBatches());
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
            <Building2 className="h-5 w-5 text-teal-600" />
            <h1 className="text-xl font-semibold text-slate-900">Bank Transfers</h1>
            <span className="relative flex h-2 w-2 ml-1">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
          </div>
          <p className="text-xs text-slate-400">ACH · Wire · Real-Time Payments · SEPA · Returns · Cut-off windows</p>
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
              tab === t ? "border-teal-600 text-teal-600" : "border-transparent text-slate-500 hover:text-slate-700"
            )}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview"    && <OverviewTab   transfers={transfers} />}
      {tab === "Transfers"   && <TransfersTab  transfers={transfers} />}
      {tab === "ACH Batches" && <ACHBatchesTab batches={batches} />}
      {tab === "Returns"     && <ReturnsTab    transfers={transfers} />}
      {tab === "Lifecycle"   && <LifecycleTab />}
    </div>
  );
}
