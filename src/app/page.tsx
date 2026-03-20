"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { generateTransactions, calcMetrics, DEFAULT_CONFIG } from "@/lib/simulation/card-engine";
import { formatCentsCompact, formatPercent } from "@/lib/data/formatters";

const DOMAINS = [
  { label: "Card Payments",  href: "/card",          live: true,  desc: "Authorization, capture, clearing, settlement, chargebacks, interchange." },
  { label: "Bank Transfers", href: "/bank",          live: true,  desc: "ACH credits/debits, returns, real-time rails, cut-off windows." },
  { label: "Cross-Border",   href: "/crossborder",   live: true,  desc: "SWIFT messaging, FX conversion, correspondent banking, sanctions." },
  { label: "Risk & Fraud",   href: "/risk",          live: true,  desc: "Velocity controls, device scoring, rule engine, review queues." },
  { label: "Reconciliation", href: "/reconciliation",live: true,  desc: "Settlement files, exception handling, ledger drift, break analysis." },
  { label: "Compliance",     href: "/compliance",    live: true,  desc: "KYC/AML, transaction monitoring, reserves, prefunding, treasury." },
];

export default function OverviewPage() {
  const [metrics, setMetrics] = useState({ volume: "—", count: "—", approval: "—", fees: "—" });

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
    <div className="px-8 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-gray-400 uppercase tracking-wide">Live — simulation running</span>
        </div>
        <h1 className="text-lg font-semibold text-gray-900">PayCore Payments OS</h1>
        <p className="mt-1 text-sm text-gray-500 max-w-xl">
          Production-grade payments platform covering the full lifecycle across six domains.
          Built to demonstrate real-world systems expertise.
        </p>
      </div>

      {/* Snapshot */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        {[
          { label: "Simulated volume", value: metrics.volume },
          { label: "Transactions",     value: metrics.count },
          { label: "Approval rate",    value: metrics.approval },
          { label: "Total fees",       value: metrics.fees },
        ].map((m) => (
          <div key={m.label} className="bg-white border border-gray-200 rounded p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider">{m.label}</p>
            <p className="mt-1 text-xl font-semibold text-gray-900 tabular-nums">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Domains */}
      <div className="border border-gray-200 rounded overflow-hidden">
        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Domains</p>
        </div>
        {DOMAINS.map((d, i) => (
          <div key={d.label}
            className={`flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition-colors ${i < DOMAINS.length - 1 ? "border-b border-gray-100" : ""}`}>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 w-32">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
                <span className="text-sm font-medium text-gray-900">{d.label}</span>
              </div>
              <span className="text-xs text-gray-400">{d.desc}</span>
            </div>
            <Link href={d.href}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors shrink-0">
              Open <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
