"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CreditCard,
  Building2,
  Globe,
  ShieldAlert,
  BarChart3,
  Scale,
  ArrowRight,
  Zap,
} from "lucide-react";
import {
  generateTransactions,
  calcMetrics,
  DEFAULT_CONFIG,
} from "@/lib/simulation/card-engine";
import { formatCentsCompact, formatPercent } from "@/lib/data/formatters";

const DOMAINS = [
  {
    icon:    CreditCard,
    label:   "Card Payments",
    desc:    "Authorization, capture, clearing, settlement, chargebacks, interchange fees.",
    href:    "/card",
    live:    true,
    accent:  "bg-blue-500",
  },
  {
    icon:    Building2,
    label:   "Bank Transfers",
    desc:    "ACH credits and debits, returns, real-time rails, cut-off windows.",
    href:    "/bank",
    live: true,
    accent:  "bg-teal-500",
  },
  {
    icon:    Globe,
    label:   "Cross-Border",
    desc:    "SWIFT messaging, FX conversion, correspondent banking, sanctions screening.",
    href:    "/crossborder",
    live: true,
    accent:  "bg-orange-500",
  },
  {
    icon:    ShieldAlert,
    label:   "Risk & Fraud",
    desc:    "Velocity controls, device scoring, rule engine, manual review queues.",
    href:    "/risk",
    live: true,
    accent:  "bg-amber-500",
  },
  {
    icon:    BarChart3,
    label:   "Reconciliation",
    desc:    "Settlement files, exception handling, ledger drift, unmatched transactions.",
    href:    "/reconciliation",
    live: true,
    accent:  "bg-green-500",
  },
  {
    icon:    Scale,
    label:   "Compliance",
    desc:    "KYC/AML, transaction monitoring, reserves, prefunding, treasury ops.",
    href:    "/compliance",
    live:    false,
    accent:  "bg-purple-500",
  },
];

export default function OverviewPage() {
  const [metrics, setMetrics] = useState({
    volume: "$0",
    count: "0",
    approval: "0%",
    fees: "$0",
  });

  useEffect(() => {
    const txns = generateTransactions(200, DEFAULT_CONFIG);
    const m = calcMetrics(txns);
    setMetrics({
      volume:   formatCentsCompact(m.totalVolume),
      count:    m.totalCount.toLocaleString(),
      approval: formatPercent(m.approvalRate),
      fees:     formatCentsCompact(m.totalFees),
    });
  }, []);

  return (
    <div className="px-8 py-8 max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span className="text-xs font-medium text-green-600">System live — simulation running</span>
        </div>
        <h1 className="text-2xl font-semibold text-slate-900">PayCore Payments OS</h1>
        <p className="mt-1.5 text-sm text-slate-500 max-w-2xl">
          A production-grade payments platform covering the full lifecycle across six domains.
          Built to demonstrate real-world systems expertise — not tutorials.
        </p>
      </div>

      {/* Live snapshot */}
      <div className="grid grid-cols-4 gap-4 mb-10">
        {[
          { label: "Simulated volume",   value: metrics.volume,   accent: "border-l-blue-500" },
          { label: "Transactions",        value: metrics.count,    accent: "border-l-slate-400" },
          { label: "Approval rate",       value: metrics.approval, accent: "border-l-green-500" },
          { label: "Total fees",          value: metrics.fees,     accent: "border-l-purple-500" },
        ].map((m) => (
          <div
            key={m.label}
            className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm border-l-4 ${m.accent}`}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{m.label}</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Domain grid */}
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-4">
        Domains
      </h2>
      <div className="grid grid-cols-2 gap-4">
        {DOMAINS.map((d) => {
          const Icon = d.icon;
          return (
            <div
              key={d.label}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col gap-3"
            >
              <div className="flex items-start justify-between">
                <div className={`${d.accent} p-2 rounded-lg`}>
                  <Icon className="h-4 w-4 text-white" />
                </div>
                {d.live ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-[10px] font-medium text-green-700">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                    </span>
                    Live
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                    <Zap className="h-2.5 w-2.5" />
                    Coming soon
                  </span>
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{d.label}</p>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">{d.desc}</p>
              </div>
              {d.live && (
                <Link
                  href={d.href}
                  className="mt-auto inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  Open dashboard <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
