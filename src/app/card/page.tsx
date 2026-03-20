"use client";

import { useEffect, useState, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import clsx from "clsx";
import { generateTransactions, generateChargebacks, generateSettlementBatches, calcMetrics, DEFAULT_CONFIG } from "@/lib/simulation/card-engine";
import { formatCents, formatCentsCompact, formatPercent, formatDateTime, formatDate, timeAgo, CARD_STATUS_LABEL, CHARGEBACK_STATUS_LABEL, SETTLEMENT_STATUS_LABEL, DECLINE_REASON_LABEL, NETWORK_LABEL } from "@/lib/data/formatters";
import StatusBadge from "@/components/ui/StatusBadge";
import MetricCard from "@/components/ui/MetricCard";
import CardLifecycle from "@/components/shared/CardLifecycle";
import PageShell from "@/components/shared/PageShell";
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
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
        <MetricCard label="Total volume" value={formatCentsCompact(metrics.totalVolume)} sub={`${metrics.totalCount.toLocaleString()} transactions`} />
        <MetricCard label="Approval rate" value={formatPercent(metrics.approvalRate)} accent={metrics.approvalRate > 0.88 ? "green" : "red"} trend={metrics.approvalRate > 0.88 ? "up" : "down"} trendLabel={metrics.approvalRate > 0.88 ? "Above 88% target" : "Below target"} />
        <MetricCard label="Chargeback rate" value={formatPercent(metrics.chargebackRate, 2)} accent={metrics.chargebackRate > 0.01 ? "red" : undefined} />
        <MetricCard label="Pending settlement" value={formatCentsCompact(metrics.pendingSettlement)} sub="Auth + captured + clearing" />
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:12 }}>
        <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:6, padding:16 }}>
          <p style={{ fontSize:10, color:"#9ca3af", textTransform:"uppercase", letterSpacing:"0.06em", margin:"0 0 12px" }}>Volume by hour ($)</p>
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

        <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:6, padding:16, display:"flex", flexDirection:"column", gap:16 }}>
          <div>
            <p style={{ fontSize:10, color:"#9ca3af", textTransform:"uppercase", letterSpacing:"0.06em", margin:"0 0 8px" }}>By status</p>
            <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
              {statusBreakdown.map(([status, count]) => (
                <div key={status} style={{ display:"flex", justifyContent:"space-between", fontSize:12 }}>
                  <span style={{ color:"#6b7280", textTransform:"capitalize" }}>{status}</span>
                  <span style={{ fontWeight:500, color:"#111827", fontVariantNumeric:"tabular-nums" }}>{count}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ borderTop:"1px solid #f3f4f6", paddingTop:12 }}>
            <p style={{ fontSize:10, color:"#9ca3af", textTransform:"uppercase", letterSpacing:"0.06em", margin:"0 0 8px" }}>By network</p>
            <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
              {networkBreakdown.map(([net, count]) => (
                <div key={net} style={{ display:"flex", justifyContent:"space-between", fontSize:12 }}>
                  <span style={{ color:"#6b7280" }}>{NETWORK_LABEL[net]}</span>
                  <span style={{ fontWeight:500, color:"#111827", fontVariantNumeric:"tabular-nums" }}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:6, padding:16 }}>
          <p style={{ fontSize:10, color:"#9ca3af", textTransform:"uppercase", letterSpacing:"0.06em", margin:"0 0 12px" }}>Decline reasons</p>
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

        <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:6, padding:16 }}>
          <p style={{ fontSize:10, color:"#9ca3af", textTransform:"uppercase", letterSpacing:"0.06em", margin:"0 0 12px" }}>Fee breakdown</p>
          <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:14 }}>
            {[
              { label: "Interchange fees",  value: formatCentsCompact(metrics.totalFees * 0.78) },
              { label: "Scheme fees",       value: formatCentsCompact(metrics.totalFees * 0.08) },
              { label: "Processing fees",   value: formatCentsCompact(metrics.totalFees * 0.14) },
            ].map((f) => (
              <div key={f.label} style={{ display:"flex", justifyContent:"space-between", fontSize:12 }}>
                <span style={{ color:"#6b7280" }}>{f.label}</span>
                <span style={{ fontWeight:500, color:"#111827" }}>{f.value}</span>
              </div>
            ))}
          </div>
          <div style={{ borderTop:"1px solid #e5e7eb", paddingTop:12, display:"flex", justifyContent:"space-between", fontSize:12 }}>
            <span style={{ color:"#6b7280" }}>Net revenue after fees</span>
            <span style={{ fontWeight:600, color:"#15803d" }}>{formatCentsCompact(metrics.netRevenue)}</span>
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
    <div style={{ display:"flex", gap:16 }}>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", gap:6, marginBottom:12, flexWrap:"wrap" }}>
          {["all", "settled", "authorized", "clearing", "declined", "chargeback", "refunded"].map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={`filter-btn${filter === s ? " active" : ""}`}>
              {s === "all" ? "All" : CARD_STATUS_LABEL[s as keyof typeof CARD_STATUS_LABEL]}
            </button>
          ))}
        </div>
        <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:6, overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ borderBottom:"1px solid #e5e7eb", background:"#f9fafb" }}>
                {["ID", "Merchant", "Amount", "Network", "Status", "Created"].map((h) => (
                  <th key={h} style={{ padding:"10px 12px", textAlign:"left", fontSize:10, fontWeight:500, color:"#9ca3af", textTransform:"uppercase", letterSpacing:"0.06em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 60).map((t) => (
                <tr key={t.id} onClick={() => setSelected(t)}
                  style={{ borderBottom:"1px solid #f3f4f6", cursor:"pointer", background: selected?.id === t.id ? "#eff6ff" : "#fff" }}
                  onMouseEnter={(e) => { if (selected?.id !== t.id) e.currentTarget.style.background = "#f9fafb"; }}
                  onMouseLeave={(e) => { if (selected?.id !== t.id) e.currentTarget.style.background = "#fff"; }}>
                  <td style={{ padding:"8px 12px", fontFamily:"monospace", fontSize:11, color:"#9ca3af" }}>{t.id}</td>
                  <td style={{ padding:"8px 12px" }}>
                    <div style={{ fontSize:12, fontWeight:500, color:"#111827" }}>{t.merchantName}</div>
                    <div style={{ fontSize:11, color:"#9ca3af" }}>{t.merchantCategory}</div>
                  </td>
                  <td style={{ padding:"8px 12px", fontSize:12, fontWeight:600, color:"#111827", fontVariantNumeric:"tabular-nums" }}>{formatCents(t.amount)}</td>
                  <td style={{ padding:"8px 12px", fontSize:12, color:"#6b7280" }}>{NETWORK_LABEL[t.cardNetwork]}</td>
                  <td style={{ padding:"8px 12px" }}>
                    <StatusBadge status={t.status} type="card" label={CARD_STATUS_LABEL[t.status]} size="sm" />
                  </td>
                  <td style={{ padding:"8px 12px", fontSize:12, color:"#9ca3af" }}>{timeAgo(t.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div style={{ width:280, flexShrink:0 }}>
          <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:6, padding:16, position:"sticky", top:16, display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
              <div>
                <p style={{ fontSize:13, fontWeight:500, color:"#111827", margin:0 }}>{selected.merchantName}</p>
                <p style={{ fontSize:11, color:"#9ca3af", margin:"2px 0 0", fontFamily:"monospace" }}>{selected.id}</p>
              </div>
              <StatusBadge status={selected.status} type="card" label={CARD_STATUS_LABEL[selected.status]} />
            </div>
            <p style={{ fontSize:20, fontWeight:600, color:"#111827", fontVariantNumeric:"tabular-nums", margin:0 }}>{formatCents(selected.amount)}</p>
            {selected.declineReason && (
              <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:4, padding:"8px 10px" }}>
                <p style={{ fontSize:11, fontWeight:500, color:"#dc2626", margin:0 }}>{DECLINE_REASON_LABEL[selected.declineReason]}</p>
              </div>
            )}
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
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
                <div key={k} style={{ display:"flex", justifyContent:"space-between", fontSize:11 }}>
                  <span style={{ color:"#9ca3af" }}>{k}</span>
                  <span style={{ fontWeight:500, color:"#374151" }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ borderTop:"1px solid #f3f4f6", paddingTop:12, display:"flex", flexDirection:"column", gap:6 }}>
              <p style={{ fontSize:10, color:"#9ca3af", textTransform:"uppercase", letterSpacing:"0.06em", margin:0 }}>Fees</p>
              {[
                ["Gross", formatCents(selected.amount)],
                ["Interchange", `−${formatCents(selected.interchangeFee)}`],
                ["Scheme", `−${formatCents(selected.schemeFee)}`],
                ["Processing", `−${formatCents(selected.processingFee)}`],
              ].map(([k, v]) => (
                <div key={k} style={{ display:"flex", justifyContent:"space-between", fontSize:11 }}>
                  <span style={{ color:"#9ca3af" }}>{k}</span>
                  <span style={{ color:"#374151" }}>{v}</span>
                </div>
              ))}
              <div style={{ borderTop:"1px solid #f3f4f6", paddingTop:8, display:"flex", justifyContent:"space-between", fontSize:11 }}>
                <span style={{ fontWeight:500, color:"#374151" }}>Net settlement</span>
                <span style={{ fontWeight:600, color:"#15803d" }}>{formatCents(selected.netSettlement)}</span>
              </div>
            </div>
            <div style={{ borderTop:"1px solid #f3f4f6", paddingTop:12, display:"flex", flexDirection:"column", gap:6 }}>
              <p style={{ fontSize:10, color:"#9ca3af", textTransform:"uppercase", letterSpacing:"0.06em", margin:0 }}>Timeline</p>
              {[
                ["Created", selected.createdAt], ["Authorized", selected.authorizedAt],
                ["Captured", selected.capturedAt], ["Cleared", selected.clearedAt], ["Settled", selected.settledAt],
              ].map(([label, ts]) => (
                <div key={label} style={{ display:"flex", justifyContent:"space-between", fontSize:11 }}>
                  <span style={{ color: ts ? "#9ca3af" : "#e5e7eb" }}>{label}</span>
                  <span style={{ color: ts ? "#374151" : "#e5e7eb" }}>{ts ? formatDateTime(ts) : "—"}</span>
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
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
        {[
          { label: "Open cases", value: chargebacks.filter(c => !["won","lost"].includes(c.status)).length },
          { label: "Won",        value: chargebacks.filter(c => c.status === "won").length },
          { label: "Lost",       value: chargebacks.filter(c => c.status === "lost").length },
        ].map((m) => (
          <div key={m.label} style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:6, padding:16 }}>
            <p style={{ fontSize:10, color:"#9ca3af", textTransform:"uppercase", letterSpacing:"0.06em", margin:0 }}>{m.label}</p>
            <p style={{ fontSize:22, fontWeight:600, color:"#111827", margin:"4px 0 0", fontVariantNumeric:"tabular-nums" }}>{m.value}</p>
          </div>
        ))}
      </div>
      <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:6, overflow:"hidden" }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ borderBottom:"1px solid #e5e7eb", background:"#f9fafb" }}>
              {["Case ID", "Transaction", "Amount", "Reason", "Status", "Deadline"].map((h) => (
                <th key={h} style={{ padding:"10px 12px", textAlign:"left", fontSize:10, fontWeight:500, color:"#9ca3af", textTransform:"uppercase", letterSpacing:"0.06em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chargebacks.map((cb) => (
              <tr key={cb.id} style={{ borderBottom:"1px solid #f3f4f6" }}>
                <td style={{ padding:"8px 12px", fontFamily:"monospace", fontSize:11, color:"#9ca3af" }}>{cb.id}</td>
                <td style={{ padding:"8px 12px", fontFamily:"monospace", fontSize:11, color:"#9ca3af" }}>{cb.transactionId}</td>
                <td style={{ padding:"8px 12px", fontSize:12, fontWeight:600, color:"#111827", fontVariantNumeric:"tabular-nums" }}>{formatCents(cb.amount)}</td>
                <td style={{ padding:"8px 12px", fontSize:12, color:"#6b7280", textTransform:"capitalize" }}>{cb.reason.replace(/_/g, " ")}</td>
                <td style={{ padding:"8px 12px" }}>
                  <StatusBadge status={cb.status} type="chargeback" label={CHARGEBACK_STATUS_LABEL[cb.status]} size="sm" />
                </td>
                <td style={{ padding:"8px 12px", fontSize:12, color:"#9ca3af" }}>{formatDate(cb.deadlineAt)}</td>
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
    <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:6, overflow:"hidden" }}>
      <table style={{ width:"100%", borderCollapse:"collapse" }}>
        <thead>
          <tr style={{ borderBottom:"1px solid #e5e7eb", background:"#f9fafb" }}>
            {["Batch", "Date", "Transactions", "Gross", "Fees", "Net", "Processor", "Status"].map((h) => (
              <th key={h} style={{ padding:"10px 12px", textAlign:"left", fontSize:10, fontWeight:500, color:"#9ca3af", textTransform:"uppercase", letterSpacing:"0.06em" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {batches.map((b) => (
            <tr key={b.id} style={{ borderBottom:"1px solid #f3f4f6" }}>
              <td style={{ padding:"8px 12px", fontFamily:"monospace", fontSize:11, color:"#9ca3af" }}>{b.id}</td>
              <td style={{ padding:"8px 12px", fontSize:12, color:"#374151" }}>{formatDate(b.date)}</td>
              <td style={{ padding:"8px 12px", fontSize:12, color:"#374151", fontVariantNumeric:"tabular-nums" }}>{b.transactionCount.toLocaleString()}</td>
              <td style={{ padding:"8px 12px", fontSize:12, fontWeight:600, color:"#111827", fontVariantNumeric:"tabular-nums" }}>{formatCentsCompact(b.grossAmount)}</td>
              <td style={{ padding:"8px 12px", fontSize:12, color:"#dc2626", fontVariantNumeric:"tabular-nums" }}>−{formatCentsCompact(b.totalFees)}</td>
              <td style={{ padding:"8px 12px", fontSize:12, fontWeight:600, color:"#15803d", fontVariantNumeric:"tabular-nums" }}>{formatCentsCompact(b.netAmount)}</td>
              <td style={{ padding:"8px 12px", fontSize:12, color:"#6b7280" }}>{b.processor}</td>
              <td style={{ padding:"8px 12px" }}>
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

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <PageShell
      title="Card Payments"
      subtitle="Authorization → Capture → Clearing → Settlement → Reconciliation"
      lastRefresh={lastRefresh}
      refreshing={refreshing}
      onRefresh={refresh}
      tabs={TABS}
      activeTab={tab}
      onTabChange={(t) => setTab(t as Tab)}
    >
      {tab === "Overview"     && <OverviewTab     txns={txns} />}
      {tab === "Transactions" && <TransactionsTab txns={txns} />}
      {tab === "Chargebacks"  && <ChargebacksTab  chargebacks={chargebacks} />}
      {tab === "Settlement"   && <SettlementTab   batches={batches} />}
      {tab === "Lifecycle"    && <CardLifecycle />}
    </PageShell>
  );
}
