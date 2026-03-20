"use client";

import { useEffect, useState, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import clsx from "clsx";
import { generateBankTransfers, generateACHBatches, calcBankMetrics } from "@/lib/simulation/bank-engine";
import { formatCents, formatCentsCompact, formatPercent, formatDateTime, formatDate, timeAgo, BANK_STATUS_LABEL, BANK_TYPE_LABEL } from "@/lib/data/formatters";
import { BankTransfer, ACHBatch } from "@/types/payments";
import MetricCard from "@/components/ui/MetricCard";
import PageShell from "@/components/shared/PageShell";

const TABS = ["Overview", "Transfers", "ACH Batches", "Returns", "Lifecycle"] as const;
type Tab = typeof TABS[number];

const BANK_STAGES = [
  { id: "initiation", label: "1. Initiation", timing: "T+0", color: "text-gray-700", bg: "bg-gray-50", border: "border-gray-300",
    description: "The originator creates a payment instruction with the ODFI. For ACH, entries are batched — ACH is not a per-transaction system. The instruction includes routing number, account number, amount, effective date, and entry description.",
    technical: ["NACHA file: fixed-width flat file format", "Batch header: company name, entry description, effective date", "Detail record: routing, account, amount, trace number", "Prenote: zero-dollar test entry to validate new accounts", "No real-time authorization — originator simply instructs"],
    keyDiff: "Unlike cards, there is no real-time approval. The originator sends the instruction and learns of problems only after the fact via return entries." },
  { id: "submission", label: "2. Submission", timing: "T+0 cut-off", color: "text-gray-700", bg: "bg-gray-50", border: "border-gray-300",
    description: "The ODFI submits the NACHA file to the ACH operator before the cut-off window. Missing a cut-off means waiting for the next batch window — a minimum T+1 delay.",
    technical: ["Fed ACH cut-offs: 10:30am, 2:45pm, 5:00pm ET", "Same-Day ACH cut-off: 2:45pm ET (settles same day 5pm)", "File formats: CCD, PPD, CTX, TEL, WEB", "Batch balancing: total debits must equal total credits", "File validation: routing numbers, account format, totals"],
    keyDiff: "Missing a cut-off window means waiting for the next batch — minimum T+1 delay. Card auth is real-time regardless of time of day." },
  { id: "processing", label: "3. Processing", timing: "T+0 to T+1", color: "text-gray-700", bg: "bg-gray-50", border: "border-gray-300",
    description: "The ACH operator sorts and distributes entries to RDFIs. The RDFI has until settlement to post the entry or return it. There is no real-time visibility into RDFI processing.",
    technical: ["ACH operator: FedACH or EPN (The Clearing House)", "RDFI must post or initiate return within 2 banking days", "R06: ODFI can recall within 5 banking days", "No approval or decline — only post-fact returns", "Return rate thresholds: 0.5% admin, 3% unauthorized"],
    keyDiff: "There is no approval or decline at this stage — unlike card auth. Problems only surface as return entries after settlement." },
  { id: "settlement", label: "4. Settlement", timing: "T+1 to T+3", color: "text-green-700", bg: "bg-green-50", border: "border-green-200",
    description: "The Fed nets all ACH positions and settles via master accounts. ACH debit settlement is provisional — funds can be reversed via returns for up to 60 days in some cases.",
    technical: ["Settlement via Federal Reserve master accounts", "Net settlement: Fed nets ODFI/RDFI positions", "Credits: RDFI must make funds available by settlement", "Debits: ODFI provisionally credited — reversible until return window", "Same-Day ACH settles 5:00pm ET"],
    keyDiff: "ACH debit settlement is provisional — funds can be clawed back for up to 60 days. Wire settlement is final and irrevocable the moment it settles." },
  { id: "returns", label: "5. Returns", timing: "T+1 to T+60", color: "text-red-700", bg: "bg-red-50", border: "border-red-200",
    description: "The RDFI returns an entry by sending a return entry to the ODFI with a standardized R-code. The window varies: 2 banking days for most, 60 days for unauthorized debits.",
    technical: ["Standard return window: 2 banking days", "Unauthorized return window: 60 calendar days (R05, R07, R10, R29)", "Return entry: same format as original with R-code addenda", "Dishonored returns: ODFI can dishonor an improper return", "NACHA penalty: >0.5% admin or >3% unauthorized triggers review"],
    keyDiff: "Card chargebacks require cardholder action (120-day window). ACH unauthorized debits are returned automatically by the RDFI — no cardholder dispute process needed." },
];

const RAILS = [
  { name: "ACH Credit",  speed: "T+1 / T+3",  reversible: "Limited",         risk: "Low",    pull: false, rtp: false },
  { name: "ACH Debit",   speed: "T+2 / T+4",  reversible: "Yes — 60 days",   risk: "Medium", pull: true,  rtp: false },
  { name: "Wire",        speed: "Same day",    reversible: "Irrevocable",     risk: "High",   pull: false, rtp: false },
  { name: "RTP",         speed: "Seconds",     reversible: "No",              risk: "High",   pull: false, rtp: true  },
  { name: "SEPA Credit", speed: "T+1",         reversible: "Limited",         risk: "Low",    pull: false, rtp: false },
  { name: "SEPA Debit",  speed: "T+2",         reversible: "Yes — 8 weeks",   risk: "Medium", pull: true,  rtp: false },
];

function StatusPill({ status }: { status: string }) {
  const color =
    status === "settled"            ? "text-green-700" :
    status === "returned" || status === "failed" ? "text-red-600" :
    status === "pending_settlement" || status === "submitted" ? "text-blue-600" :
    "text-gray-500";
  const isLive = ["submitted","pending_settlement"].includes(status);
  return (
    <span className={clsx("inline-flex items-center gap-1 text-xs font-medium", color)}>
      {isLive
        ? <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70 animate-pulse" />
        : <span className="h-1.5 w-1.5 rounded-full bg-current opacity-40" />}
      {BANK_STATUS_LABEL[status] ?? status}
    </span>
  );
}

function OverviewTab({ transfers }: { transfers: BankTransfer[] }) {
  const metrics = calcBankMetrics(transfers);
  const byType = Object.entries(transfers.reduce((acc,t) => { acc[t.type]=(acc[t.type]??0)+1; return acc; },{} as Record<string,number>))
    .map(([name,value]) => ({ name: BANK_TYPE_LABEL[name]?.replace(" Transfer","").replace(" Credit","Cr").replace(" Debit","Db") ?? name, value }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <MetricCard label="Total volume"    value={formatCentsCompact(metrics.totalVolume)} sub={`${metrics.totalCount} transfers`} />
        <MetricCard label="Return rate"     value={formatPercent(metrics.returnRate,2)} accent={metrics.returnRate>0.005?"red":undefined} trendLabel={metrics.returnRate>0.005?"Above 0.5% NACHA limit":undefined} trend={metrics.returnRate>0.005?"down":undefined} />
        <MetricCard label="Avg settlement"  value={`${metrics.avgSettlementHours}h`} sub="Initiation to settled" />
        <MetricCard label="Pending volume"  value={formatCentsCompact(metrics.pendingVolume)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-gray-200 rounded p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Transfers by rail</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={byType}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#9ca3af" }} />
              <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} />
              <Tooltip contentStyle={{ fontSize: 11, border: "1px solid #e5e7eb" }} />
              <Bar dataKey="value" fill="#374151" radius={[2,2,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-gray-200 rounded p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Rail comparison</p>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100">
                {["Rail","Speed","Reversible","Risk","Pull","24/7"].map(h => (
                  <th key={h} className="pb-1.5 text-left text-[10px] font-medium text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RAILS.map(r => (
                <tr key={r.name} className="border-b border-gray-50">
                  <td className="py-1.5 font-medium text-gray-900">{r.name}</td>
                  <td className="py-1.5 text-gray-600">{r.speed}</td>
                  <td className={clsx("py-1.5 font-medium", r.reversible==="Irrevocable"||r.reversible==="No" ? "text-red-600":"text-yellow-600")}>{r.reversible}</td>
                  <td className={clsx("py-1.5", r.risk==="High"?"text-red-600":r.risk==="Medium"?"text-yellow-600":"text-green-700")}>{r.risk}</td>
                  <td className="py-1.5 text-gray-400">{r.pull?"✓":"—"}</td>
                  <td className="py-1.5 text-gray-400">{r.rtp?"✓":"—"}</td>
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
  const [selected, setSelected] = useState<BankTransfer|null>(null);
  const [filter, setFilter] = useState("all");
  const filtered = filter==="all"?transfers:transfers.filter(t=>filter==="returned"?t.status==="returned":t.type===filter);

  return (
    <div className="flex gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex gap-2 mb-3 flex-wrap">
          {["all","ach_credit","ach_debit","wire","rtp","returned"].map(f => (
            <button key={f} onClick={()=>setFilter(f)}
              className={clsx("px-2.5 py-1 text-xs rounded border transition-colors",
                filter===f?"bg-gray-900 text-white border-gray-900":"bg-white text-gray-500 border-gray-200 hover:border-gray-400"
              )}>
              {f==="all"?"All":f==="returned"?"Returns":BANK_TYPE_LABEL[f]}
            </button>
          ))}
        </div>
        <div className="bg-white border border-gray-200 rounded overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {["ID","From → To","Amount","Type","Status","Effective"].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-medium text-gray-400 uppercase tracking-wider text-[10px]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0,60).map(t => (
                <tr key={t.id} onClick={()=>setSelected(t)}
                  className={clsx("border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors", selected?.id===t.id&&"bg-blue-50")}>
                  <td className="px-3 py-2 font-mono text-gray-400">{t.id}</td>
                  <td className="px-3 py-2"><div className="font-medium text-gray-900">{t.senderName}</div><div className="text-gray-400">→ {t.receiverName}</div></td>
                  <td className="px-3 py-2 font-semibold text-gray-900 tabular-nums">{formatCents(t.amount,t.currency)}</td>
                  <td className="px-3 py-2 text-gray-500">{BANK_TYPE_LABEL[t.type]}</td>
                  <td className="px-3 py-2"><StatusPill status={t.status} /></td>
                  <td className="px-3 py-2 text-gray-400">{formatDate(t.effectiveDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {selected && (
        <div className="w-72 shrink-0">
          <div className="bg-white border border-gray-200 rounded p-4 sticky top-4 space-y-3">
            <div><p className="font-medium text-gray-900">{selected.senderName}</p><p className="text-xs text-gray-400 font-mono">{selected.id}</p></div>
            <p className="text-xl font-semibold text-gray-900 tabular-nums">{formatCents(selected.amount,selected.currency)}</p>
            {selected.returnCode && (
              <div className="bg-red-50 border border-red-100 rounded p-2">
                <p className="text-xs font-semibold text-red-600">{selected.returnCode} — {selected.returnDescription}</p>
              </div>
            )}
            <div className="space-y-1.5">
              {[["Rail",BANK_TYPE_LABEL[selected.type]],["Direction",selected.type.includes("debit")?"Pull (debit)":"Push (credit)"],["Same-Day",selected.isSameDayACH?"Yes":"No"],["Sender bank",selected.senderBank],["Receiver bank",selected.receiverBank],["Trace",selected.traceNumber??"—"],["Description",selected.description]].map(([k,v])=>(
                <div key={k} className="flex justify-between text-xs"><span className="text-gray-400">{k}</span><span className="font-medium text-gray-700 text-right max-w-[160px]">{v}</span></div>
              ))}
            </div>
            <div className="border-t border-gray-100 pt-3 space-y-1.5">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Timeline</p>
              {[["Initiated",selected.createdAt],["Submitted",selected.submittedAt],["Settled",selected.settledAt],["Returned",selected.returnedAt]].map(([l,ts])=>(
                <div key={l} className="flex justify-between text-xs"><span className={ts?"text-gray-400":"text-gray-200"}>{l}</span><span className={ts?"text-gray-700":"text-gray-200"}>{ts?formatDateTime(ts):"—"}</span></div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ACHBatchesTab({ batches }: { batches: ACHBatch[] }) {
  const STATUS_COLORS: Record<string,string> = { created:"text-gray-400", submitted:"text-blue-600", processing:"text-yellow-600", settled:"text-green-700", returned:"text-red-600" };
  return (
    <div className="space-y-3">
      <div className="bg-white border border-gray-200 rounded p-3">
        <p className="text-xs text-gray-500 leading-relaxed">ACH is a batch system — entries are grouped into NACHA files submitted to the ACH operator at scheduled cut-off windows. Each batch has an effective date determining when the RDFI must post entries.</p>
      </div>
      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <table className="w-full text-xs">
          <thead><tr className="border-b border-gray-100 bg-gray-50">{["Batch","Company","Entry desc","Effective","Count","Credit","Debit","Returns","Status"].map(h=><th key={h} className="px-3 py-2.5 text-left font-medium text-gray-400 uppercase tracking-wider text-[10px]">{h}</th>)}</tr></thead>
          <tbody>{batches.map(b=>(
            <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50">
              <td className="px-3 py-2 font-mono text-gray-400">{b.id}</td>
              <td className="px-3 py-2 font-medium text-gray-900">{b.companyName}</td>
              <td className="px-3 py-2 text-gray-500">{b.entryDescription}</td>
              <td className="px-3 py-2 text-gray-600">{formatDate(b.effectiveDate)}</td>
              <td className="px-3 py-2 text-gray-700 tabular-nums">{b.transferCount}</td>
              <td className="px-3 py-2 text-green-700 tabular-nums">{formatCentsCompact(b.totalCredit)}</td>
              <td className="px-3 py-2 text-gray-700 tabular-nums">{formatCentsCompact(b.totalDebit)}</td>
              <td className={clsx("px-3 py-2 tabular-nums", b.returnRate>0.005?"text-red-600":"text-gray-500")}>{b.returnCount} ({formatPercent(b.returnRate,2)})</td>
              <td className={clsx("px-3 py-2 font-medium text-xs", STATUS_COLORS[b.status])}>{b.status}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

function ReturnsTab({ transfers }: { transfers: BankTransfer[] }) {
  const returns = transfers.filter(t=>t.status==="returned");
  const RETURN_CODE_DESC: Record<string,string> = { R01:"Insufficient funds",R02:"Account closed",R03:"No account found",R04:"Invalid account number",R05:"Unauthorized debit",R07:"Authorization revoked",R08:"Payment stopped",R10:"Not authorized",R16:"Account frozen",R29:"Corporate not authorized" };
  const byCode = Object.entries(returns.reduce((acc,t)=>{ const k=t.returnCode??"unknown"; acc[k]=(acc[k]??0)+1; return acc; },{} as Record<string,number>)).sort(([,a],[,b])=>b-a).map(([code,count])=>({code,count}));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded p-4"><p className="text-xs text-gray-400 uppercase tracking-wider">Returns</p><p className="mt-1 text-xl font-semibold text-red-600 tabular-nums">{returns.length}</p></div>
        <div className="bg-white border border-gray-200 rounded p-4"><p className="text-xs text-gray-400 uppercase tracking-wider">Return rate</p><p className="mt-1 text-xl font-semibold text-gray-900 tabular-nums">{formatPercent(returns.length/(transfers.length||1),2)}</p></div>
        <div className="bg-white border border-gray-200 rounded p-4"><p className="text-xs text-gray-400 uppercase tracking-wider">Returned volume</p><p className="mt-1 text-xl font-semibold text-gray-900 tabular-nums">{formatCentsCompact(returns.reduce((s,t)=>s+t.amount,0))}</p></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-gray-200 rounded p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">By return code</p>
          <ResponsiveContainer width="100%" height={180}><BarChart data={byCode} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false}/><XAxis type="number" tick={{fontSize:10,fill:"#9ca3af"}}/><YAxis dataKey="code" type="category" tick={{fontSize:10,fill:"#6b7280"}} width={32}/><Tooltip contentStyle={{fontSize:11,border:"1px solid #e5e7eb"}}/><Bar dataKey="count" fill="#374151" radius={[0,2,2,0]}/></BarChart></ResponsiveContainer>
        </div>
        <div className="bg-white border border-gray-200 rounded p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Return code reference</p>
          <div className="space-y-2 overflow-y-auto max-h-[180px]">
            {Object.entries(RETURN_CODE_DESC).map(([code,desc])=>(
              <div key={code} className="flex items-start gap-2 text-xs">
                <span className="shrink-0 font-mono font-semibold text-gray-700 w-8">{code}</span>
                <span className="text-gray-500">{desc}</span>
                {["R05","R07","R10","R29"].includes(code) && <span className="shrink-0 text-[10px] font-medium text-yellow-600">60d</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
      {returns.length > 0 && (
        <div className="bg-white border border-gray-200 rounded overflow-hidden">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-gray-100 bg-gray-50">{["Transfer ID","Sender","Amount","Code","Reason","Returned"].map(h=><th key={h} className="px-3 py-2.5 text-left font-medium text-gray-400 uppercase tracking-wider text-[10px]">{h}</th>)}</tr></thead>
            <tbody>{returns.map(t=>(
              <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-gray-400">{t.id}</td>
                <td className="px-3 py-2 font-medium text-gray-900">{t.senderName}</td>
                <td className="px-3 py-2 font-semibold text-gray-900 tabular-nums">{formatCents(t.amount)}</td>
                <td className="px-3 py-2 font-mono font-semibold text-red-600">{t.returnCode}</td>
                <td className="px-3 py-2 text-gray-500">{t.returnDescription}</td>
                <td className="px-3 py-2 text-gray-400">{t.returnedAt?timeAgo(t.returnedAt):"—"}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LifecycleTab() {
  const [selected, setSelected] = useState(BANK_STAGES[0]);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {BANK_STAGES.map((stage,i)=>(
          <div key={stage.id} className="flex items-center shrink-0">
            <button onClick={()=>setSelected(stage)} className={clsx("rounded border px-3 py-2 text-left transition-all min-w-[110px]", selected.id===stage.id?`${stage.bg} ${stage.border}`:"bg-white border-gray-200 hover:border-gray-300")}>
              <p className={clsx("text-xs font-semibold", selected.id===stage.id?stage.color:"text-gray-700")}>{stage.label}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{stage.timing}</p>
            </button>
            {i<BANK_STAGES.length-1&&<svg width="16" height="16" viewBox="0 0 16 16" className="mx-0.5 shrink-0"><path d="M2 8L14 8" stroke="#d1d5db" strokeWidth="1.5" fill="none"/><path d="M10 5L14 8L10 11" stroke="#d1d5db" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </div>
        ))}
      </div>
      <div className={clsx("rounded border p-5", selected.bg, selected.border)}>
        <div className="flex items-start justify-between mb-3">
          <div><h3 className={clsx("text-sm font-semibold",selected.color)}>{selected.label}</h3><p className="text-xs text-gray-400 mt-0.5">Timing: {selected.timing}</p></div>
        </div>
        <p className="text-sm text-gray-700 leading-relaxed mb-4">{selected.description}</p>
        <div className="rounded bg-yellow-50 border border-yellow-200 p-2.5 mb-4">
          <p className="text-xs text-yellow-800 font-medium">{selected.keyDiff}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mb-2">Technical detail</p>
          <ul className="space-y-1">{selected.technical.map(t=><li key={t} className="flex items-start gap-2 text-xs text-gray-600"><span className="mt-1 h-1 w-1 rounded-full bg-gray-400 shrink-0"/>{t}</li>)}</ul>
        </div>
      </div>
    </div>
  );
}

export default function BankPage() {
  const [tab,setTab]=useState<Tab>("Overview");
  const [transfers,setTransfers]=useState<BankTransfer[]>([]);
  const [batches,setBatches]=useState<ACHBatch[]>([]);
  const [refreshing,setRefreshing]=useState(false);
  const [lastRefresh,setLastRefresh]=useState(new Date());

  const refresh=useCallback(()=>{ setRefreshing(true); setTimeout(()=>{ setTransfers(generateBankTransfers(100)); setBatches(generateACHBatches()); setLastRefresh(new Date()); setRefreshing(false); },400); },[]);
  useEffect(()=>{ refresh(); const id=setInterval(refresh,30_000); return()=>clearInterval(id); },[refresh]);

  return (
    <PageShell title="Bank Transfers" subtitle="ACH · Wire · Real-Time Payments · SEPA · Returns · Cut-off windows" lastRefresh={lastRefresh} refreshing={refreshing} onRefresh={refresh} tabs={TABS} activeTab={tab} onTabChange={(t)=>setTab(t as Tab)}>
      {tab==="Overview"    && <OverviewTab   transfers={transfers}/>}
      {tab==="Transfers"   && <TransfersTab  transfers={transfers}/>}
      {tab==="ACH Batches" && <ACHBatchesTab batches={batches}/>}
      {tab==="Returns"     && <ReturnsTab    transfers={transfers}/>}
      {tab==="Lifecycle"   && <LifecycleTab/>}
    </PageShell>
  );
}
