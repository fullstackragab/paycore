"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { generateTransactions, calcMetrics, DEFAULT_CONFIG } from "@/lib/simulation/card-engine";
import { formatCentsCompact, formatPercent } from "@/lib/data/formatters";

const DOMAINS = [
  { label: "Card Payments",  href: "/card",           desc: "Authorization, capture, clearing, settlement, chargebacks, interchange." },
  { label: "Bank Transfers", href: "/bank",           desc: "ACH credits/debits, returns, real-time rails, cut-off windows." },
  { label: "Cross-Border",   href: "/crossborder",    desc: "SWIFT messaging, FX conversion, correspondent banking, sanctions." },
  { label: "Risk & Fraud",   href: "/risk",           desc: "Velocity controls, device scoring, rule engine, review queues." },
  { label: "Reconciliation", href: "/reconciliation", desc: "Settlement files, exception handling, ledger drift, break analysis." },
  { label: "Compliance",     href: "/compliance",     desc: "KYC/AML, transaction monitoring, reserves, prefunding, treasury." },
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
    <div style={{ maxWidth: 900 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#16a34a", display: "inline-block" }} />
          <span style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>Live — simulation running</span>
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: "#111827", margin: 0 }}>PayCore Payments OS</h1>
        <p style={{ fontSize: 13, color: "#6b7280", marginTop: 6, maxWidth: 560 }}>
          Production-grade payments platform covering the full lifecycle across six domains.
          Built to demonstrate real-world systems expertise.
        </p>
      </div>

      {/* Metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
        {[
          { label: "Simulated volume", value: metrics.volume },
          { label: "Transactions",     value: metrics.count },
          { label: "Approval rate",    value: metrics.approval },
          { label: "Total fees",       value: metrics.fees },
        ].map((m) => (
          <div key={m.label} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6, padding: "14px 16px" }}>
            <p style={{ fontSize: 10, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>{m.label}</p>
            <p style={{ fontSize: 20, fontWeight: 600, color: "#111827", margin: "4px 0 0", fontVariantNumeric: "tabular-nums" }}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Domains table */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6, overflow: "hidden" }}>
        <div style={{ padding: "8px 16px", borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
          <p style={{ fontSize: 10, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0, fontWeight: 500 }}>Domains</p>
        </div>
        {DOMAINS.map((d, i) => (
          <div key={d.label} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 16px", borderBottom: i < DOMAINS.length - 1 ? "1px solid #f3f4f6" : "none",
            background: "#fff",
          }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 24, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, width: 160, flexShrink: 0 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#16a34a", flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>{d.label}</span>
              </div>
              <span style={{ fontSize: 12, color: "#9ca3af" }}>{d.desc}</span>
            </div>
            <Link href={d.href} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#9ca3af", flexShrink: 0, marginLeft: 16 }}>
              Open <ArrowRight style={{ width: 12, height: 12 }} />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
