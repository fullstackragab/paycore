"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Scale, RefreshCw, AlertTriangle, CheckCircle, ShieldAlert, TrendingUp } from "lucide-react";
import clsx from "clsx";

import {
  generateKYCRecords, generateAMLAlerts,
  generateReserveAccounts, generateTreasuryPositions,
  calcComplianceMetrics,
} from "@/lib/simulation/compliance-engine";
import {
  formatCents, formatCentsCompact, formatPercent,
  formatDate, formatDateTime, timeAgo,
} from "@/lib/data/formatters";
import { KYCRecord, AMLAlert, ReserveAccount, TreasuryPosition } from "@/types/payments";
import MetricCard from "@/components/ui/MetricCard";

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = ["Overview", "KYC / KYB", "AML alerts", "Reserves", "Treasury", "Concepts"] as const;
type Tab = typeof TABS[number];

const KYC_STATUS_META: Record<string, { label: string; color: string }> = {
  approved:     { label: "Approved",     color: "bg-green-100 text-green-800 border-green-200" },
  pending:      { label: "Pending",      color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  rejected:     { label: "Rejected",     color: "bg-red-100 text-red-800 border-red-200" },
  needs_review: { label: "Needs review", color: "bg-gray-50 text-orange-800 border-gray-200" },
  expired:      { label: "Expired",      color: "bg-slate-100 text-slate-600 border-slate-200" },
};

const AML_STATUS_META: Record<string, { label: string; color: string }> = {
  open:          { label: "Open",         color: "bg-red-100 text-red-800 border-red-200" },
  investigating: { label: "Investigating",color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  escalated:     { label: "Escalated",    color: "bg-gray-50 text-orange-800 border-gray-200" },
  cleared:       { label: "Cleared",      color: "bg-green-100 text-green-800 border-green-200" },
  reported:      { label: "SAR Filed",    color: "bg-gray-50 text-purple-800 border-gray-200" },
};

const RISK_TIER_META: Record<string, { color: string; bg: string }> = {
  low:    { color: "text-green-700",  bg: "bg-green-50 border-green-200" },
  medium: { color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200" },
  high:   { color: "text-red-700",    bg: "bg-red-50 border-red-200" },
};

const AML_TYPE_LABEL: Record<string, string> = {
  structuring:              "Structuring",
  rapid_movement:           "Rapid movement",
  high_risk_corridor:       "High-risk corridor",
  round_amount_pattern:     "Round amount pattern",
  dormant_account_activity: "Dormant account activity",
  unusual_velocity:         "Unusual velocity",
  pep_transaction:          "PEP transaction",
  sanctions_proximity:      "Sanctions proximity",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function KYCBadge({ status }: { status: string }) {
  const m = KYC_STATUS_META[status] ?? { label: status, color: "bg-slate-100 text-slate-600 border-slate-200" };
  return <span className={clsx("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium", m.color)}>{m.label}</span>;
}

function AMLBadge({ status }: { status: string }) {
  const m = AML_STATUS_META[status] ?? { label: status, color: "bg-slate-100 text-slate-600 border-slate-200" };
  const isLive = ["open", "investigating", "escalated"].includes(status);
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", m.color)}>
      {isLive && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-current" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current" />
        </span>
      )}
      {m.label}
    </span>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function OverviewTab({ kyc, aml, reserves }: { kyc: KYCRecord[]; aml: AMLAlert[]; reserves: ReserveAccount[] }) {
  const metrics = calcComplianceMetrics(kyc, aml, reserves);

  const kycData = [
    { name: "Approved",     value: metrics.approvedKYC,  fill: "#22c55e" },
    { name: "Pending",      value: metrics.pendingKYC,   fill: "#eab308" },
    { name: "Rejected",     value: metrics.rejectedKYC,  fill: "#ef4444" },
    { name: "Needs review", value: kyc.filter(k => k.status === "needs_review").length, fill: "#f97316" },
    { name: "Expired",      value: kyc.filter(k => k.status === "expired").length,      fill: "#94a3b8" },
  ];

  const amlData = Object.entries(
    aml.reduce((acc, a) => { acc[a.alertType] = (acc[a.alertType] ?? 0) + 1; return acc; }, {} as Record<string, number>)
  ).sort(([,a],[,b]) => b - a).map(([name, value]) => ({ name: AML_TYPE_LABEL[name] ?? name, value }));

  const riskData = [
    { name: "Low risk",    value: kyc.filter(k => k.riskTier === "low").length,    fill: "#22c55e" },
    { name: "Medium risk", value: kyc.filter(k => k.riskTier === "medium").length, fill: "#eab308" },
    { name: "High risk",   value: kyc.filter(k => k.riskTier === "high").length,   fill: "#ef4444" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <MetricCard label="KYC approved"      value={String(metrics.approvedKYC)}               sub={`of ${metrics.totalKYCRecords} total`}      accent="green" />
        <MetricCard label="Open AML alerts"   value={String(metrics.openAMLAlerts)}             sub="Requires investigation"                     accent={metrics.openAMLAlerts > 5 ? "red" : "yellow"} />
        <MetricCard label="SARs filed"        value={String(metrics.sarsFiled)}                 sub="Suspicious Activity Reports"                accent="purple" />
        <MetricCard label="Reserve held"      value={formatCentsCompact(metrics.totalReserveHeld)} sub="Across all merchant reserves"            accent="blue" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">KYC status</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={kycData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#94a3b8" }} angle={-15} textAnchor="end" height={36} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <Tooltip />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {kycData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Customer risk tiers</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={riskData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <Tooltip />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {riskData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">AML alerts by type</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={amlData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 9, fill: "#64748b" }} width={130} />
              <Tooltip />
              <Bar dataKey="value" fill="#f97316" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Compliance framework */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Compliance framework overview</h3>
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "KYC",    full: "Know Your Customer",   color: "border-gray-200 bg-gray-50",   desc: "Verify identity of individuals. Passport, ID, address proof." },
            { label: "KYB",    full: "Know Your Business",   color: "border-gray-200 bg-gray-50", desc: "Verify business entities, beneficial owners, and legitimacy." },
            { label: "AML",    full: "Anti-Money Laundering",color: "border-gray-200 bg-gray-50",desc: "Monitor transactions for suspicious patterns and report to authorities." },
            { label: "Sanctions",full:"Sanctions screening", color: "border-red-200 bg-red-50",     desc: "Screen against OFAC, EU, UN lists. Block prohibited entities." },
          ].map((f) => (
            <div key={f.label} className={clsx("rounded-xl border p-4", f.color)}>
              <p className="text-lg font-bold text-slate-900">{f.label}</p>
              <p className="text-xs font-medium text-slate-600 mt-0.5">{f.full}</p>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function KYCTab({ records }: { records: KYCRecord[] }) {
  const [selected, setSelected] = useState<KYCRecord | null>(null);
  const [filter,   setFilter]   = useState("all");

  const filtered = filter === "all" ? records : records.filter(r =>
    filter === "high" ? r.riskTier === "high" : r.status === filter
  );

  return (
    <div className="flex gap-5">
      <div className="flex-1 min-w-0">
        <div className="flex gap-2 mb-4 flex-wrap">
          {["all", "approved", "pending", "needs_review", "rejected", "expired", "high"].map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={clsx("rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                filter === f ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
              )}>
              {f === "all" ? "All" : f === "high" ? "⚠ High risk" : KYC_STATUS_META[f]?.label ?? f}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {["ID", "Name", "Type", "Country", "Risk tier", "Status", "Documents", "Expires"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 60).map((r) => (
                <tr key={r.id} onClick={() => setSelected(r)}
                  className={clsx("border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors",
                    selected?.id === r.id && "bg-gray-50",
                    r.riskTier === "high" && "bg-red-50 hover:bg-red-100",
                  )}>
                  <td className="px-4 py-2.5 font-mono text-slate-400">{r.id}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-900">{r.customerName}</td>
                  <td className="px-4 py-2.5 text-slate-500 capitalize">{r.customerType}</td>
                  <td className="px-4 py-2.5 text-slate-600">{r.country}</td>
                  <td className="px-4 py-2.5">
                    <span className={clsx("rounded-full px-2 py-0.5 text-xs font-medium border",
                      RISK_TIER_META[r.riskTier]?.bg ?? "", RISK_TIER_META[r.riskTier]?.color ?? ""
                    )}>
                      {r.riskTier}
                    </span>
                  </td>
                  <td className="px-4 py-2.5"><KYCBadge status={r.status} /></td>
                  <td className="px-4 py-2.5 text-slate-500">{r.documentsSubmitted.length} docs</td>
                  <td className="px-4 py-2.5 text-slate-400">{formatDate(r.expiresAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="w-72 shrink-0">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5 sticky top-4 space-y-4">
            <div>
              <p className="font-semibold text-slate-900">{selected.customerName}</p>
              <p className="text-xs text-slate-400 mt-0.5">{selected.id} · {selected.customerId}</p>
              <div className="flex items-center gap-2 mt-2">
                <KYCBadge status={selected.status} />
                <span className={clsx("rounded-full border px-2 py-0.5 text-xs font-medium",
                  RISK_TIER_META[selected.riskTier]?.bg, RISK_TIER_META[selected.riskTier]?.color
                )}>
                  {selected.riskTier} risk
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              {[
                ["Customer type", selected.customerType],
                ["Country",       selected.country],
                ["Created",       formatDate(selected.createdAt)],
                ["Expires",       formatDate(selected.expiresAt)],
                ["Reviewed by",   selected.reviewedBy ?? "—"],
                ["Reviewed at",   selected.reviewedAt ? formatDate(selected.reviewedAt) : "—"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs">
                  <span className="text-slate-400">{k}</span>
                  <span className="font-medium text-slate-700 capitalize">{v}</span>
                </div>
              ))}
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Documents</p>
              <div className="space-y-1">
                {selected.documentsSubmitted.map((doc) => (
                  <div key={doc} className="flex items-center gap-2 text-xs">
                    <CheckCircle className="h-3 w-3 text-green-500 shrink-0" />
                    <span className="text-slate-600">{doc}</span>
                  </div>
                ))}
              </div>
            </div>

            {selected.notes && (
              <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
                <p className="text-xs font-semibold text-amber-700 mb-1">Review notes</p>
                <p className="text-xs text-amber-600 leading-relaxed">{selected.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AMLTab({ alerts }: { alerts: AMLAlert[] }) {
  const [selected, setSelected] = useState<AMLAlert | null>(null);
  const [filter,   setFilter]   = useState("all");

  const filtered = filter === "all" ? alerts : alerts.filter(a => a.status === filter);
  const open = alerts.filter(a => ["open","investigating","escalated"].includes(a.status));

  return (
    <div className="flex gap-5">
      <div className="flex-1 min-w-0 space-y-4">
        {open.length > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-red-600 shrink-0" />
            <p className="text-sm font-medium text-red-800">
              {open.length} active AML alerts require investigation — {alerts.filter(a => a.status === "escalated").length} escalated
            </p>
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          {["all", "open", "investigating", "escalated", "cleared", "reported"].map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={clsx("rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                filter === f ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
              )}>
              {f === "all" ? "All" : AML_STATUS_META[f]?.label ?? f}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {["ID", "Customer", "Alert type", "Risk score", "Amount", "Txns", "SAR", "Status", "Created"].map((h) => (
                  <th key={h} className="px-3 py-3 text-left font-medium text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 60).map((a) => (
                <tr key={a.id} onClick={() => setSelected(a)}
                  className={clsx("border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors",
                    selected?.id === a.id && "bg-gray-50",
                    ["open","escalated"].includes(a.status) && "bg-red-50 hover:bg-red-100",
                  )}>
                  <td className="px-3 py-2.5 font-mono text-slate-400">{a.id}</td>
                  <td className="px-3 py-2.5 font-medium text-slate-900">{a.customerName}</td>
                  <td className="px-3 py-2.5 text-slate-600">{AML_TYPE_LABEL[a.alertType]}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full w-12">
                        <div className={clsx("h-full rounded-full", a.riskScore >= 70 ? "bg-red-500" : a.riskScore >= 50 ? "bg-gray-50" : "bg-yellow-400")}
                          style={{ width: `${a.riskScore}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-slate-700">{a.riskScore}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 font-semibold text-slate-900">{formatCentsCompact(a.totalAmount)}</td>
                  <td className="px-3 py-2.5 text-slate-600">{a.transactionCount}</td>
                  <td className="px-3 py-2.5">
                    {a.sarFiled && <span className="rounded bg-gray-50 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700">SAR</span>}
                  </td>
                  <td className="px-3 py-2.5"><AMLBadge status={a.status} /></td>
                  <td className="px-3 py-2.5 text-slate-400">{timeAgo(a.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="w-80 shrink-0">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5 sticky top-4 space-y-4 max-h-[85vh] overflow-y-auto">
            <div>
              <p className="font-semibold text-slate-900">{selected.customerName}</p>
              <p className="text-xs text-slate-400 mt-0.5">{selected.id}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <AMLBadge status={selected.status} />
                {selected.sarFiled && (
                  <span className="rounded-full bg-gray-50 border border-gray-200 px-2 py-0.5 text-xs font-semibold text-purple-700">SAR Filed</span>
                )}
              </div>
            </div>

            <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
              <p className="text-xs font-semibold text-amber-800 mb-1">{AML_TYPE_LABEL[selected.alertType]}</p>
              <p className="text-xs text-amber-700 leading-relaxed">{selected.description}</p>
            </div>

            <div className="space-y-1.5">
              {[
                ["Risk score",       `${selected.riskScore}/100`],
                ["Total amount",     formatCentsCompact(selected.totalAmount)],
                ["Transactions",     String(selected.transactionCount)],
                ["Currency",         selected.currency],
                ["Assigned to",      selected.assignedTo ?? "Unassigned"],
                ["Created",          formatDate(selected.createdAt)],
                ["Resolved",         selected.resolvedAt ? formatDate(selected.resolvedAt) : "—"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs">
                  <span className="text-slate-400">{k}</span>
                  <span className="font-medium text-slate-700">{v}</span>
                </div>
              ))}
            </div>

            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
              <p className="text-xs font-semibold text-slate-600 mb-1">SAR obligation</p>
              <p className="text-xs text-slate-500 leading-relaxed">
                If suspicious activity is confirmed, a Suspicious Activity Report (SAR) must be filed with FinCEN within 30 days of detection. Filing is confidential — the customer must not be tipped off ("tipping off" is a criminal offence).
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReservesTab({ reserves }: { reserves: ReserveAccount[] }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs text-slate-500 leading-relaxed max-w-3xl">
          Merchant reserves protect the payment processor against chargeback losses. When a merchant has elevated risk (new business, high chargeback rate, or high-risk MCC), the processor withholds a percentage of settlement funds — typically 5–10% — held in a reserve account. Reserves are released on a schedule once risk subsides.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Rolling reserve",  desc: "Fixed % of each settlement withheld, released after 90–180 days", color: "border-l-gray-300" },
          { label: "Fixed reserve",    desc: "Fixed lump sum withheld upfront, released when contract ends",     color: "border-l-gray-300" },
          { label: "Capped reserve",   desc: "Rolling reserve up to a maximum cap, then no further withholding", color: "border-l-gray-300" },
        ].map((r) => (
          <div key={r.label} className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm border-l-4 ${r.color}`}>
            <p className="text-sm font-semibold text-slate-900">{r.label}</p>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{r.desc}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              {["Merchant", "Type", "Reserve rate", "Current balance", "Required", "Coverage", "Next release", "Amount"].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reserves.map((r) => {
              const coverage = r.currentBalance / (r.requiredBalance || 1);
              return (
                <tr key={r.id} className={clsx("border-b border-slate-50 hover:bg-slate-50",
                  coverage < 0.8 && "bg-red-50"
                )}>
                  <td className="px-4 py-2.5 font-medium text-slate-900">{r.merchantName}</td>
                  <td className="px-4 py-2.5 capitalize text-slate-600">{r.reserveType}</td>
                  <td className="px-4 py-2.5 font-semibold text-slate-900">{formatPercent(r.reserveRate, 1)}</td>
                  <td className="px-4 py-2.5 font-semibold text-slate-900">{formatCentsCompact(r.currentBalance)}</td>
                  <td className="px-4 py-2.5 text-slate-600">{formatCentsCompact(r.requiredBalance)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full w-16">
                        <div className={clsx("h-full rounded-full", coverage >= 1 ? "bg-green-500" : coverage >= 0.8 ? "bg-yellow-400" : "bg-red-500")}
                          style={{ width: `${Math.min(coverage * 100, 100)}%` }} />
                      </div>
                      <span className={clsx("text-xs font-semibold", coverage >= 1 ? "text-green-600" : coverage >= 0.8 ? "text-yellow-600" : "text-red-600")}>
                        {formatPercent(coverage, 0)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-slate-400">{formatDate(r.nextReleaseDate)}</td>
                  <td className="px-4 py-2.5 text-green-600 font-medium">{formatCentsCompact(r.nextReleaseAmount)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TreasuryTab({ positions }: { positions: TreasuryPosition[] }) {
  const totalNostro = positions.reduce((s, p) => s + p.nostroBalance, 0);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs text-slate-500 leading-relaxed max-w-3xl">
          Treasury operations manage the actual cash positions across currencies and correspondent accounts. Nostro accounts hold funds at correspondent banks in local currencies. Prefunding ensures funds are available before outgoing payments settle. Intraday liquidity must be managed carefully — a shortfall can delay all outgoing payments.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-l-4 border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total nostro balance</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{formatCentsCompact(totalNostro)}</p>
          <p className="text-xs text-slate-400 mt-0.5">Across {positions.length} currencies</p>
        </div>
        <div className="rounded-xl border border-l-4 border-green-500 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total available</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{formatCentsCompact(positions.reduce((s,p) => s + p.availableAmount, 0))}</p>
          <p className="text-xs text-slate-400 mt-0.5">After prefunding and reserves</p>
        </div>
        <div className="rounded-xl border border-l-4 border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Pending outbound</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{formatCentsCompact(positions.reduce((s,p) => s + p.pendingOutbound, 0))}</p>
          <p className="text-xs text-slate-400 mt-0.5">Awaiting settlement</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              {["Currency", "Nostro balance", "Prefunded", "Reserved", "Available", "Pending in", "Pending out", "Updated"].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => (
              <tr key={p.currency} className={clsx("border-b border-slate-50 hover:bg-slate-50",
                p.availableAmount < p.pendingOutbound && "bg-red-50"
              )}>
                <td className="px-4 py-2.5 font-mono font-bold text-slate-900">{p.currency}</td>
                <td className="px-4 py-2.5 font-semibold text-slate-900">{formatCentsCompact(p.nostroBalance)}</td>
                <td className="px-4 py-2.5 text-blue-600">{formatCentsCompact(p.prefundedAmount)}</td>
                <td className="px-4 py-2.5 text-purple-600">{formatCentsCompact(p.reservedAmount)}</td>
                <td className={clsx("px-4 py-2.5 font-semibold", p.availableAmount < p.pendingOutbound ? "text-red-600" : "text-green-600")}>
                  {formatCentsCompact(p.availableAmount)}
                </td>
                <td className="px-4 py-2.5 text-green-600">+{formatCentsCompact(p.pendingInbound)}</td>
                <td className="px-4 py-2.5 text-red-600">−{formatCentsCompact(p.pendingOutbound)}</td>
                <td className="px-4 py-2.5 text-slate-400">{timeAgo(p.lastUpdated)}</td>
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
      title: "KYC vs KYB",
      color: "border-l-gray-300",
      body: "KYC (Know Your Customer) verifies individual identity — passport, national ID, selfie, address proof. KYB (Know Your Business) verifies business entities — incorporation documents, UBO (Ultimate Beneficial Owner) declaration, director IDs. Both have ongoing requirements: documents expire, risk tiers change, re-verification is triggered by suspicious activity.",
    },
    {
      title: "Risk-based approach",
      color: "border-l-gray-300",
      body: "Regulations don't mandate the same checks for everyone — they mandate a risk-based approach. Low-risk customers (domestic, small amounts, transparent purpose) get lighter-touch checks. High-risk customers (PEPs, high-risk countries, complex structures) get enhanced due diligence (EDD): source of wealth questions, senior management approval, frequent re-review.",
    },
    {
      title: "AML transaction monitoring",
      color: "border-l-gray-300",
      body: "Rule-based and ML-powered systems watch for patterns: structuring (multiple transactions just below $10K to avoid CTR filing), layering (rapid movement through multiple accounts to obscure origin), integration (reintroducing funds into the legitimate economy). Monitoring must be calibrated — too sensitive = alert fatigue, too loose = regulatory risk.",
    },
    {
      title: "SARs and tipping off",
      color: "border-l-red-500",
      body: "When suspicious activity is confirmed, a Suspicious Activity Report must be filed with FinCEN (US), the NCA (UK), or the relevant FIU. The filing is confidential by law — informing the subject ('tipping off') is a criminal offence. The institution must freeze the account or continue monitoring while the SAR is processed.",
    },
    {
      title: "Merchant reserves",
      color: "border-l-gray-300",
      body: "Processors hold merchant reserves to protect against chargeback liability. If a merchant goes out of business or their chargeback rate spikes, the processor is liable to issuers. The reserve is the buffer. Rolling reserves (5–10% withheld, released after 90–180 days) are most common. High-risk merchants face larger reserves, sometimes 10–20%.",
    },
    {
      title: "Prefunding and liquidity",
      color: "border-l-green-500",
      body: "Cross-border and real-time payment providers must prefund nostro accounts in each currency before payments can go out. If prefunding runs out, outgoing payments queue until more funds arrive. Intraday liquidity management — knowing exactly where your cash is, in which currency, at which correspondent, at every moment — is a core treasury function.",
    },
    {
      title: "Safeguarding",
      color: "border-l-gray-300",
      body: "E-money institutions and payment institutions must segregate customer funds from their own operating funds. This 'safeguarding' requirement ensures that if the institution fails, customer funds are protected. Funds must be held in a segregated bank account or invested in high-quality liquid assets. Safeguarding audits are a regulatory requirement.",
    },
    {
      title: "Licensing basics",
      color: "border-l-gray-300",
      body: "Operating a payment service requires a license. In the EU: PSD2 Payment Institution or E-Money Institution license. In the US: Money Transmitter License in each state (or partner with a licensed sponsor bank). In the UK: FCA authorization. Licensing determines what products you can offer, what capital you must hold, and what regulations apply.",
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

export default function CompliancePage() {
  const [tab,        setTab]        = useState<Tab>("Overview");
  const [kyc,        setKyc]        = useState<KYCRecord[]>([]);
  const [aml,        setAml]        = useState<AMLAlert[]>([]);
  const [reserves,   setReserves]   = useState<ReserveAccount[]>([]);
  const [treasury,   setTreasury]   = useState<TreasuryPosition[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh,setLastRefresh]= useState(new Date());

  const refresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setKyc(generateKYCRecords(80));
      setAml(generateAMLAlerts(40));
      setReserves(generateReserveAccounts());
      setTreasury(generateTreasuryPositions());
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
            <Scale className="h-5 w-5 text-purple-600" />
            <h1 className="text-xl font-semibold text-slate-900">Compliance & Treasury</h1>
            <span className="relative flex h-2 w-2 ml-1">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
          </div>
          <p className="text-xs text-slate-400">KYC/KYB · AML monitoring · SARs · Merchant reserves · Prefunding · Nostro positions</p>
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
              tab === t ? "border-gray-200 text-purple-600" : "border-transparent text-slate-500 hover:text-slate-700"
            )}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview"   && <OverviewTab  kyc={kyc} aml={aml} reserves={reserves} />}
      {tab === "KYC / KYB"  && <KYCTab      records={kyc} />}
      {tab === "AML alerts" && <AMLTab      alerts={aml} />}
      {tab === "Reserves"   && <ReservesTab reserves={reserves} />}
      {tab === "Treasury"   && <TreasuryTab positions={treasury} />}
      {tab === "Concepts"   && <ConceptsTab />}
    </div>
  );
}
