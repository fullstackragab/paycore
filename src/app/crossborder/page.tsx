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
} from "recharts";
import {
  Globe,
  RefreshCw,
  AlertTriangle,
  ShieldAlert,
  ArrowRight,
} from "lucide-react";
import clsx from "clsx";

import {
  generateCrossBorderPayments,
  generateFXRates,
  calcCrossBorderMetrics,
} from "@/lib/simulation/crossborder-engine";
import {
  formatCents,
  formatCentsCompact,
  formatPercent,
  formatDateTime,
  formatDate,
  timeAgo,
  XB_STATUS_LABEL,
  XB_STATUS_COLORS,
  SWIFT_TYPE_LABEL,
} from "@/lib/data/formatters";
import { CrossBorderPayment, FXRate } from "@/types/payments";
import MetricCard from "@/components/ui/MetricCard";
import PageShell from "@/components/shared/PageShell";

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  "Overview",
  "Payments",
  "FX Rates",
  "SWIFT",
  "Compliance",
] as const;
type Tab = (typeof TABS)[number];

// colors removed — monochrome charts

// ─── SWIFT lifecycle stages ───────────────────────────────────────────────────

const SWIFT_STAGES = [
  {
    id: "initiation",
    label: "1. Payment initiation",
    color: "text-slate-700",
    bg: "bg-slate-50",
    border: "border-slate-300",
    timing: "T+0",
    description:
      "Originator instructs their bank (ordering bank) to send funds. The bank collects required fields: beneficiary BIC, IBAN, purpose code, and remittance info. KYC/KYB on the sender is verified.",
    technical: [
      "Ordering bank validates: BIC format, IBAN check digit, purpose code",
      "Transaction limit checks and daily exposure limits",
      "Documentation required above reporting thresholds (e.g. $10,000 CTR in US)",
      "SWIFT GPI assigns a UETR (Unique End-to-end Transaction Reference)",
    ],
    keyPoint:
      "Unlike domestic payments, the originator must provide structured data — free-text remittance fields cause downstream processing failures.",
  },
  {
    id: "compliance",
    label: "2. Compliance & sanctions",
    color: "text-yellow-700",
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    timing: "T+0 (minutes)",
    description:
      "The bank screens both sender and receiver against sanctions lists (OFAC, EU, UN). AML transaction monitoring checks for suspicious patterns. High-risk corridors trigger enhanced due diligence.",
    technical: [
      "Sanctions screening: OFAC SDN list, EU consolidated list, UN list",
      "Fuzzy name matching — partial name matches trigger manual review",
      "PEP (Politically Exposed Person) screening",
      "AML rules: structuring detection, unusual corridor, round amounts",
      "High-risk countries require additional documentation",
    ],
    keyPoint:
      "A sanctions hold can freeze funds indefinitely — there is no automatic release. The originating bank must work with compliance to resolve.",
  },
  {
    id: "fx",
    label: "3. FX conversion",
    color: "text-blue-700",
    bg: "bg-gray-50",
    border: "border-gray-200",
    timing: "T+0 (seconds for spot)",
    description:
      "If sender and receiver currencies differ, the bank executes an FX conversion. Spot rates apply for same-day conversion. The spread between bid and ask is the bank's FX margin. Large transactions may use forward contracts.",
    technical: [
      "Spot rate: today's exchange rate for immediate settlement",
      "Forward contract: lock rate now, settle future date — eliminates FX risk",
      "FX spread: difference between buy/sell rate — bank's margin",
      "Value dating: FX settlement typically T+2 for major pairs",
      "Nostro account: bank's account held at correspondent in foreign currency",
    ],
    keyPoint:
      "The FX rate applied is the bank's rate, not the mid-market rate. The spread is often 1–3% for retail, 0.1–0.5% for wholesale — a major cost in cross-border payments.",
  },
  {
    id: "swift_message",
    label: "4. SWIFT messaging",
    color: "text-indigo-700",
    bg: "bg-gray-50",
    border: "border-gray-200",
    timing: "T+0 to T+1",
    description:
      "The ordering bank sends an MT103 message through the SWIFT network to the beneficiary bank (or correspondent). SWIFT is a messaging network — it does not move money. It instructs banks to debit and credit their nostro/vostro accounts.",
    technical: [
      "MT103: standard single customer credit transfer",
      "MT202: bank-to-bank transfer (covers correspondent leg)",
      "Fields: :20: (ref), :32A: (value date, currency, amount), :50: (ordering customer), :59: (beneficiary)",
      "SWIFT GPI: real-time tracking via UETR — know exactly where payment is",
      "SWIFT charges per message — high-frequency corridors optimize message count",
    ],
    keyPoint:
      "SWIFT moves messages, not money. The actual fund movement happens via nostro/vostro account debits and credits, and ultimately through central bank settlement.",
  },
  {
    id: "correspondent",
    label: "5. Correspondent chain",
    color: "text-purple-700",
    bg: "bg-gray-50",
    border: "border-gray-200",
    timing: "T+0 to T+2",
    description:
      "For many corridors, no direct banking relationship exists. The payment routes through one or two correspondent banks. Each correspondent charges a 'lifting fee' and may apply additional compliance checks, adding delays.",
    technical: [
      "Nostro account: 'our money at your bank' — ordering bank's USD account at correspondent",
      "Vostro account: 'your money at our bank' — mirror view",
      "Correspondent charges: $10–$50 per transaction (lifting fees)",
      "Cover method: MT103 + MT202COV sent simultaneously for speed",
      "Sequential method: MT103 chains through correspondents — slower",
    ],
    keyPoint:
      "Each correspondent adds fees and potential delays. Fintechs like Wise bypass this by holding local accounts in each currency — eliminating correspondent fees entirely.",
  },
  {
    id: "credit",
    label: "6. Beneficiary credit",
    color: "text-green-700",
    bg: "bg-green-50",
    border: "border-green-200",
    timing: "T+1 to T+3",
    description:
      "The receiving bank credits the beneficiary's account. The amount received is net of all fees deducted by correspondents and the receiving bank. Value dating determines when the beneficiary can actually use the funds.",
    technical: [
      "OUR fees: sender pays all charges — beneficiary receives full amount",
      "SHA fees: sender pays originator fees, beneficiary pays receiving fees",
      "BEN fees: beneficiary pays all charges — most common",
      "Value date: typically T+1 after the receiving bank gets funds",
      "Funds availability: may differ from credit date due to holds",
    ],
    keyPoint:
      "The beneficiary often receives less than the sent amount because fees are deducted along the chain. 'OUR' fee instruction prevents this but costs more for the sender.",
  },
];

// ─── Helper components ────────────────────────────────────────────────────────

function XBStatusPill({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    initiated: "#6b7280",
    compliance_check: "#ca8a04",
    fx_converted: "#2563eb",
    swift_sent: "#374151",
    intermediary_processing: "#374151",
    credited: "#15803d",
    failed: "#dc2626",
    returned: "#ea580c",
    sanctions_hold: "#b91c1c",
  };
  const color = colorMap[status] ?? "#6b7280";
  const isLive = [
    "compliance_check",
    "fx_converted",
    "swift_sent",
    "intermediary_processing",
  ].includes(status);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 12,
        fontWeight: 500,
        color,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: color,
          flexShrink: 0,
          opacity: isLive ? 1 : 0.5,
          animation: isLive ? "pulse 2s ease-in-out infinite" : "none",
        }}
      />
      {XB_STATUS_LABEL[status] ?? status}
    </span>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function OverviewTab({ payments }: { payments: CrossBorderPayment[] }) {
  const metrics = calcCrossBorderMetrics(payments);

  const corridorData = metrics.corridors.slice(0, 8).map((c) => ({
    name: `${c.from}→${c.to}`,
    volume: Math.round(c.volume / 100),
    count: c.count,
  }));

  const statusData = Object.entries(
    payments.reduce(
      (acc, p) => {
        acc[p.status] = (acc[p.status] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    ),
  ).map(([name, value]) => ({ name: XB_STATUS_LABEL[name] ?? name, value }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 12,
        }}
      >
        <MetricCard
          label="Total volume"
          value={formatCentsCompact(metrics.totalVolume)}
          sub={`${metrics.totalCount} payments`}
          accent="blue"
        />
        <MetricCard
          label="Avg processing"
          value={`${metrics.avgProcessingHours}h`}
          sub="Initiation to credited"
          accent="purple"
        />
        <MetricCard
          label="Sanctions holds"
          value={String(metrics.sanctionsHoldCount)}
          sub="Requires compliance review"
          accent={metrics.sanctionsHoldCount > 0 ? "red" : "green"}
        />
        <MetricCard
          label="Total fees"
          value={formatCentsCompact(
            metrics.totalFXFees + metrics.totalLiftingFees,
          )}
          sub="FX spread + lifting fees"
          accent="yellow"
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: 16,
          }}
        >
          <p
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#111827",
              margin: "0 0 14px",
            }}
          >
            Volume by corridor
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={corridorData} layout="vertical">
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f1f5f9"
                horizontal={false}
              />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
              />
              <YAxis
                dataKey="name"
                type="category"
                tick={{ fontSize: 11, fill: "#64748b" }}
                width={70}
              />
              <Tooltip
                formatter={(v) => [`$${Number(v).toLocaleString()}`, "Volume"]}
              />
              <Bar dataKey="volume" radius={[0, 4, 4, 0]}>
                {corridorData.map((_, i) => (
                  <Cell key={i} fill="#374151" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: 16,
          }}
        >
          <p
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#111827",
              margin: "0 0 14px",
            }}
          >
            Payments by status
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={statusData} layout="vertical">
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f1f5f9"
                horizontal={false}
              />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis
                dataKey="name"
                type="category"
                tick={{ fontSize: 10, fill: "#64748b" }}
                width={160}
              />
              <Tooltip />
              <Bar dataKey="value" fill="#374151" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Fee breakdown */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          padding: 20,
        }}
      >
        <p
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "#111827",
            margin: "0 0 14px",
          }}
        >
          Cost anatomy of a cross-border payment
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            gap: 12,
            marginBottom: 14,
          }}
        >
          {[
            {
              label: "FX spread fees",
              value: formatCentsCompact(metrics.totalFXFees),
              color: "border-l-blue-500",
              desc: "0.25% of notional — bank's FX margin",
            },
            {
              label: "Lifting fees",
              value: formatCentsCompact(metrics.totalLiftingFees),
              color: "border-l-purple-500",
              desc: "$15–$35 per correspondent hop",
            },
            {
              label: "Total cost",
              value: formatCentsCompact(
                metrics.totalFXFees + metrics.totalLiftingFees,
              ),
              color: "border-l-red-500",
              desc: "Borne by sender or beneficiary (SHA/OUR/BEN)",
            },
          ].map((f) => (
            <div
              key={f.label}
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: 16,
              }}
            >
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                {f.label}
              </p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {f.value}
              </p>
              <p className="mt-1 text-xs text-slate-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PaymentsTab({ payments }: { payments: CrossBorderPayment[] }) {
  const [selected, setSelected] = useState<CrossBorderPayment | null>(null);
  const [filter, setFilter] = useState("all");

  const filtered =
    filter === "all"
      ? payments
      : filter === "holds"
        ? payments.filter((p) => p.status === "sanctions_hold")
        : payments.filter(
            (p) => p.senderCountry === filter || p.receiverCountry === filter,
          );

  return (
    <div className="flex gap-5">
      <div className="flex-1 min-w-0">
        <div className="flex gap-2 mb-4 flex-wrap">
          {["all", "holds", "US", "EG", "AE", "GB"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`filter-btn ${f === f ? "" : ""}`}
              style={
                filter === f
                  ? {
                      background: "#111827",
                      color: "#fff",
                      borderColor: "#111827",
                    }
                  : {}
              }
            >
              {f === "all" ? "All" : f === "holds" ? "! Sanctions holds" : f}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {[
                  "ID",
                  "Corridor",
                  "Sender → Receiver",
                  "Send amount",
                  "FX",
                  "Receive",
                  "Status",
                  "Created",
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
              {filtered.slice(0, 60).map((p) => (
                <tr
                  key={p.id}
                  onClick={() => setSelected(p)}
                  className={clsx(
                    "border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors",
                    selected?.id === p.id && "bg-gray-50",
                    p.status === "sanctions_hold" && "bg-gray-50",
                  )}
                >
                  <td className="px-3 py-2.5 font-mono text-slate-500">
                    {p.id}
                  </td>
                  <td className="px-3 py-2.5 font-semibold text-slate-700">
                    {p.senderCountry} → {p.receiverCountry}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="text-slate-900">{p.senderName}</div>
                    <div className="text-slate-400">{p.receiverName}</div>
                  </td>
                  <td className="px-3 py-2.5 font-semibold text-slate-900">
                    {formatCents(p.sendAmount, p.sendCurrency)}
                  </td>
                  <td className="px-3 py-2.5 text-slate-500">
                    {p.fxRate.toFixed(4)}
                  </td>
                  <td className="px-3 py-2.5 font-medium text-green-700">
                    {formatCents(p.receiveAmount, p.receiveCurrency)}
                  </td>
                  <td className="px-3 py-2.5">
                    <XBStatusPill status={p.status} />
                  </td>
                  <td className="px-3 py-2.5 text-slate-400">
                    {timeAgo(p.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="w-80 shrink-0">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5 sticky top-4 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-900 text-sm">
                  {selected.senderName}
                </p>
                <p className="text-xs text-slate-400">{selected.id}</p>
              </div>
              <XBStatusPill status={selected.status} />
            </div>

            {selected.status === "sanctions_hold" && (
              <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 flex gap-2">
                <ShieldAlert className="h-4 w-4 text-gray-500 shrink-0 mt-0.5" />
                <p className="text-xs text-rose-700 font-medium">
                  Payment held for sanctions review. Requires compliance team
                  action.
                </p>
              </div>
            )}

            {selected.failureReason && (
              <div className="rounded-lg bg-red-50 border border-red-100 p-3">
                <p className="text-xs font-semibold text-red-700">
                  Failed: {selected.failureReason}
                </p>
              </div>
            )}

            {/* Corridor */}
            <div className="rounded-lg bg-slate-50 p-3 flex items-center gap-2 text-xs">
              <span className="font-semibold text-slate-700">
                {selected.senderCountry}
              </span>
              <ArrowRight className="h-3 w-3 text-slate-400" />
              <span className="font-semibold text-slate-700">
                {selected.receiverCountry}
              </span>
              <span className="ml-auto text-slate-400">
                {selected.sendCurrency} → {selected.receiveCurrency}
              </span>
            </div>

            {/* FX */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                FX conversion
              </p>
              {[
                [
                  "Send amount",
                  formatCents(selected.sendAmount, selected.sendCurrency),
                ],
                [
                  "FX rate",
                  `1 ${selected.sendCurrency} = ${selected.fxRate} ${selected.receiveCurrency}`,
                ],
                ["FX type", selected.fxConversionType],
                [
                  "FX fee",
                  `−${formatCents(selected.fxFee, selected.sendCurrency)}`,
                ],
                [
                  "Lifting fees",
                  `−${formatCents(selected.liftingFees, selected.sendCurrency)}`,
                ],
                [
                  "Our fee",
                  `−${formatCents(selected.ourFee, selected.sendCurrency)}`,
                ],
                [
                  "Receive amount",
                  formatCents(selected.receiveAmount, selected.receiveCurrency),
                ],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs">
                  <span className="text-slate-400">{k}</span>
                  <span
                    className={clsx(
                      "font-medium text-right max-w-[160px]",
                      k === "Receive amount"
                        ? "text-green-600"
                        : "text-slate-700",
                    )}
                  >
                    {v}
                  </span>
                </div>
              ))}
            </div>

            {/* SWIFT */}
            <div className="border-t border-slate-100 pt-3 space-y-1.5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                SWIFT
              </p>
              {[
                [
                  "Message type",
                  SWIFT_TYPE_LABEL[selected.swiftMessageType] ??
                    selected.swiftMessageType,
                ],
                ["UETR", selected.uetr],
                ["End-to-end ref", selected.endToEndRef],
                ["Purpose code", selected.purposeCode],
                ["Remittance", selected.remittanceInfo],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs gap-2">
                  <span className="text-slate-400 shrink-0">{k}</span>
                  <span className="font-medium text-slate-700 text-right truncate">
                    {v}
                  </span>
                </div>
              ))}
            </div>

            {/* Correspondent chain */}
            {(selected.correspondentBank1 || selected.correspondentBank2) && (
              <div className="border-t border-slate-100 pt-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Correspondent chain
                </p>
                <div className="space-y-1">
                  {[
                    selected.senderBank,
                    selected.correspondentBank1,
                    selected.correspondentBank2,
                    selected.receiverBank,
                  ]
                    .filter(Boolean)
                    .map((bank, i, arr) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs text-slate-700 font-medium">
                          {bank}
                        </span>
                        {i < arr.length - 1 && (
                          <ArrowRight className="h-3 w-3 text-slate-300" />
                        )}
                      </div>
                    ))}
                </div>
                <p className="mt-1.5 text-[10px] text-slate-400">
                  Nostro: {selected.nostroAccount}
                </p>
              </div>
            )}

            {/* Timeline */}
            <div className="border-t border-slate-100 pt-3 space-y-1.5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Timeline
              </p>
              {[
                ["Initiated", selected.createdAt],
                ["Sanctions screened", selected.sanctionsScreenedAt],
                ["Compliance cleared", selected.complianceCheckedAt],
                ["FX converted", selected.fxConvertedAt],
                ["SWIFT sent", selected.swiftSentAt],
                ["Credited", selected.creditedAt],
                ["Est. arrival", selected.estimatedArrival],
              ].map(([label, ts]) => (
                <div key={label} className="flex justify-between text-xs">
                  <span className={ts ? "text-slate-400" : "text-slate-200"}>
                    {label}
                  </span>
                  <span
                    className={clsx(
                      "font-medium",
                      ts ? "text-slate-700" : "text-slate-200",
                    )}
                  >
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

function FXRatesTab({ rates }: { rates: FXRate[] }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs text-slate-500 leading-relaxed">
          Live mid-market rates with bid/ask spread. The spread is the bank's FX
          margin — the difference between what they buy and sell currency for.
          Wholesale rates (interbank) have spreads of 0.01–0.05%. Retail
          cross-border payments typically carry 0.5–3% spread.
        </p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              {[
                "Pair",
                "Mid rate",
                "Bid",
                "Ask",
                "Spread",
                "Spread %",
                "Updated",
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
            {rates.map((r) => (
              <tr
                key={r.pair}
                className="border-b border-slate-50 hover:bg-slate-50"
              >
                <td className="px-4 py-2.5 font-mono font-semibold text-slate-900">
                  {r.pair}
                </td>
                <td className="px-4 py-2.5 font-semibold text-slate-900">
                  {r.rate.toFixed(4)}
                </td>
                <td className="px-4 py-2.5 text-blue-600">
                  {r.bid.toFixed(4)}
                </td>
                <td className="px-4 py-2.5 text-orange-600">
                  {r.ask.toFixed(4)}
                </td>
                <td className="px-4 py-2.5 text-slate-600">
                  {r.spread.toFixed(4)}
                </td>
                <td className="px-4 py-2.5 text-slate-600">
                  {((r.spread / r.rate) * 100).toFixed(3)}%
                </td>
                <td className="px-4 py-2.5 text-slate-400">
                  {timeAgo(r.updatedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SWIFTTab() {
  const MT103_FIELDS = [
    {
      tag: ":20:",
      name: "Transaction reference",
      example: "REF-20260320-001",
      desc: "Unique reference assigned by sender",
    },
    {
      tag: ":23B:",
      name: "Bank operation code",
      example: "CRED",
      desc: "CRED = credit transfer",
    },
    {
      tag: ":32A:",
      name: "Value date / amount",
      example: "260321USD10000,00",
      desc: "Settlement date, currency, amount",
    },
    {
      tag: ":33B:",
      name: "Currency / instructed amt",
      example: "USD10000,00",
      desc: "Original instructed amount",
    },
    {
      tag: ":50K:",
      name: "Ordering customer",
      example: "/123456789\nACME CORP",
      desc: "Sender account and name",
    },
    {
      tag: ":52A:",
      name: "Ordering institution",
      example: "CHASUS33",
      desc: "Sender's bank BIC",
    },
    {
      tag: ":56A:",
      name: "Intermediary institution",
      example: "DEUTDEDB",
      desc: "Correspondent bank BIC (if applicable)",
    },
    {
      tag: ":57A:",
      name: "Account with institution",
      example: "BARCGB22",
      desc: "Beneficiary's bank BIC",
    },
    {
      tag: ":59:",
      name: "Beneficiary customer",
      example: "/GB29NWBK...\nJOHN SMITH",
      desc: "Beneficiary account (IBAN) and name",
    },
    {
      tag: ":70:",
      name: "Remittance information",
      example: "INV-2026-0042",
      desc: "Payment reference / invoice number",
    },
    {
      tag: ":71A:",
      name: "Details of charges",
      example: "SHA",
      desc: "OUR / SHA / BEN — who pays fees",
    },
    {
      tag: ":72:",
      name: "Sender to receiver info",
      example: "/ACC/SALARY MARCH 26",
      desc: "Additional instructions to receiving bank",
    },
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 mb-1">
          MT103 — Single customer credit transfer
        </h3>
        <p className="text-xs text-slate-500 mb-4 leading-relaxed">
          The MT103 is the workhorse of cross-border payments — the message
          format used for virtually all customer cross-border wire transfers.
          Each field has a tag, a name, and strict formatting rules. Errors in
          any field cause the payment to be rejected or returned by the
          receiving bank.
        </p>
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {["Tag", "Field name", "Example value", "Purpose"].map((h) => (
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
              {MT103_FIELDS.map((f) => (
                <tr
                  key={f.tag}
                  className="border-b border-slate-50 hover:bg-slate-50"
                >
                  <td className="px-4 py-2.5 font-mono font-semibold text-indigo-700">
                    {f.tag}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-slate-700">
                    {f.name}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-slate-500 whitespace-pre">
                    {f.example}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{f.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">
          Charges field — OUR / SHA / BEN
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              code: "OUR",
              color: "bg-green-50 border-green-200",
              label: "Sender pays all",
              desc: "Originator covers all fees. Beneficiary receives exact amount. Used for salary payments, regulated transfers.",
            },
            {
              code: "SHA",
              color: "bg-gray-50 border-gray-200",
              label: "Shared",
              desc: "Sender pays originating fees, beneficiary pays receiving fees. Most common option for B2B transfers.",
            },
            {
              code: "BEN",
              color: "bg-gray-50 border-gray-200",
              label: "Beneficiary pays",
              desc: "All charges deducted from the transfer amount. Beneficiary receives less than sent. Uncommon in practice.",
            },
          ].map((c) => (
            <div
              key={c.code}
              className={clsx("rounded border p-4 bg-gray-50 border-gray-200")}
            >
              <p className="text-sm font-bold text-slate-900">{c.code}</p>
              <p className="text-xs font-semibold text-slate-700 mt-0.5">
                {c.label}
              </p>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                {c.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ComplianceTab({ payments }: { payments: CrossBorderPayment[] }) {
  const holds = payments.filter((p) => p.status === "sanctions_hold");
  const failed = payments.filter((p) => p.status === "failed");
  const cleared = payments.filter((p) => p.sanctionsResult === "clear");

  const SANCTIONS_LISTS = [
    {
      name: "OFAC SDN",
      country: "US",
      desc: "Office of Foreign Assets Control — Specially Designated Nationals list. Mandatory for all USD transactions.",
    },
    {
      name: "EU Consolidated",
      country: "EU",
      desc: "European Union consolidated list of persons and entities subject to financial sanctions.",
    },
    {
      name: "UN Security Council",
      country: "UN",
      desc: "United Nations Security Council sanctions — global scope, all member states must enforce.",
    },
    {
      name: "HM Treasury",
      country: "GB",
      desc: "UK Office of Financial Sanctions Implementation — applies post-Brexit independently of EU.",
    },
    {
      name: "DFAT",
      country: "AU",
      desc: "Australian Department of Foreign Affairs and Trade autonomous sanctions list.",
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-l-4 border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Sanctions holds
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {holds.length}
          </p>
          <p className="mt-0.5 text-xs text-rose-600">
            Requires compliance team review
          </p>
        </div>
        <div className="rounded-xl border border-l-4 border-red-400 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Failed
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {failed.length}
          </p>
          <p className="mt-0.5 text-xs text-red-600">
            Compliance or routing failure
          </p>
        </div>
        <div className="rounded-xl border border-l-4 border-green-500 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Cleared
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {cleared.length}
          </p>
          <p className="mt-0.5 text-xs text-green-600">
            Passed all sanctions screens
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">
          Sanctions lists screened
        </h3>
        <div className="space-y-2">
          {SANCTIONS_LISTS.map((l) => (
            <div
              key={l.name}
              className="flex items-start gap-3 rounded-lg border border-slate-100 p-3 hover:bg-slate-50"
            >
              <span className="mt-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 shrink-0">
                {l.country}
              </span>
              <div>
                <p className="text-xs font-semibold text-slate-900">{l.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{l.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {holds.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert className="h-4 w-4 text-rose-600" />
            <h3 className="text-sm font-semibold text-rose-800">
              Active sanctions holds
            </h3>
          </div>
          <div className="space-y-2">
            {holds.map((p) => (
              <div
                key={p.id}
                className="rounded-lg bg-white border border-gray-200 p-3 flex items-start justify-between gap-3"
              >
                <div>
                  <p className="text-xs font-semibold text-slate-900">
                    {p.senderName} → {p.receiverName}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {p.senderCountry} → {p.receiverCountry} ·{" "}
                    {formatCents(p.sendAmount, p.sendCurrency)}
                  </p>
                  <p className="text-xs font-mono text-slate-400 mt-0.5">
                    {p.id}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-gray-50 border border-gray-200 px-2 py-1 text-xs font-semibold text-rose-700">
                  HOLD
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SWIFTLifecycleTab() {
  const [selected, setSelected] = useState(SWIFT_STAGES[0]);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">
          Cross-border payment lifecycle
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          A cross-border payment involves messaging, FX conversion, compliance,
          liquidity, and multiple institutions — each with different operating
          windows.
        </p>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {SWIFT_STAGES.map((stage, i) => (
          <div key={stage.id} className="flex items-center shrink-0">
            <button
              onClick={() => setSelected(stage)}
              className={clsx(
                "rounded-lg border-2 px-3 py-2.5 text-left transition-all min-w-[120px]",
                selected.id === stage.id
                  ? `${stage.bg} ${stage.border} shadow-sm`
                  : "bg-white border-slate-200 hover:border-slate-300",
              )}
            >
              <p
                className={clsx(
                  "text-xs font-semibold",
                  selected.id === stage.id ? stage.color : "text-slate-700",
                )}
              >
                {stage.label}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {stage.timing}
              </p>
            </button>
            {i < SWIFT_STAGES.length - 1 && (
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                className="mx-1 shrink-0"
              >
                <path
                  d="M2 10 L18 10"
                  stroke="#374151"
                  strokeWidth="1.5"
                  fill="none"
                />
                <path
                  d="M13 6 L18 10 L13 14"
                  stroke="#374151"
                  strokeWidth="1.5"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
        ))}
      </div>

      <div
        className={clsx(
          "rounded-xl border-2 p-5 shadow-sm",
          selected.bg,
          selected.border,
        )}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className={clsx("text-base font-semibold", selected.color)}>
              {selected.label}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Timing: {selected.timing}
            </p>
          </div>
        </div>
        <p className="text-sm text-slate-700 leading-relaxed mb-4">
          {selected.description}
        </p>
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 mb-4 flex gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800 font-medium">
            {selected.keyPoint}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
            Technical detail
          </p>
          <ul className="space-y-1.5">
            {selected.technical.map((t) => (
              <li
                key={t}
                className="flex items-start gap-2 text-xs text-slate-600"
              >
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

export default function CrossBorderPage() {
  const [tab, setTab] = useState<Tab>("Overview");
  const [payments, setPayments] = useState<CrossBorderPayment[]>([]);
  const [fxRates, setFXRates] = useState<FXRate[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const refresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setPayments(generateCrossBorderPayments(80));
      setFXRates(generateFXRates());
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
    <PageShell
      title="Cross-Border Payments"
      subtitle="SWIFT · MT103 · Correspondent banking · FX conversion · Sanctions screening"
      lastRefresh={lastRefresh}
      refreshing={refreshing}
      onRefresh={refresh}
      tabs={TABS}
      activeTab={tab}
      onTabChange={(t) => setTab(t as Tab)}
    >
      {tab === "Overview" && <OverviewTab payments={payments} />}
      {tab === "Payments" && <PaymentsTab payments={payments} />}
      {tab === "FX Rates" && <FXRatesTab rates={fxRates} />}
      {tab === "SWIFT" && <SWIFTTab />}
      {tab === "Compliance" && <ComplianceTab payments={payments} />}
    </PageShell>
  );
}
