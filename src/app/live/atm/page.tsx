"use client";

import { useState } from "react";
import Link from "next/link";
import StageWizard, { Stage } from "@/components/shared/StageWizard";

const ATM_LOCATIONS = [
  { location: "Cairo International Airport — Terminal 2", id: "ATM-CAI-042" },
  { location: "Dubai Mall — Ground Floor",               id: "ATM-DXB-118" },
  { location: "Manhattan, 5th Ave & 42nd St",            id: "ATM-NYC-007" },
  { location: "Heathrow Airport — Terminal 5",           id: "ATM-LHR-033" },
];

const TEST_CARDS = [
  { pan: "4111 1111 1111 1111", label: "Visa debit — approved" },
  { pan: "5500 0000 0000 0004", label: "Mastercard — approved" },
  { pan: "4000 0000 0000 0002", label: "Visa — will decline" },
];

const AMOUNTS = ["20.00","50.00","100.00","200.00","500.00"];

export default function ATMPage() {
  const [atm, setAtm] = useState(ATM_LOCATIONS[0]);
  const [form, setForm] = useState({
    pan: "4111 1111 1111 1111", expiry: "12/28", pin: "1234", amount: "100.00",
  });
  const [stages, setStages] = useState<Stage[]>([]);
  const [processing, setProcessing] = useState(false);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [result, setResult] = useState<{ approved: boolean; authCode?: string; atmFee?: number; totalDebited?: number; reason?: string } | null>(null);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit() {
    setStages([]); setResult(null); setCurrentStageIndex(0); setProcessing(true);

    const res = await fetch("/api/live/atm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, atmLocation: atm.location, atmId: atm.id }),
    });
    const data = await res.json();

    for (let i = 0; i < data.stages.length; i++) {
      setCurrentStageIndex(i);
      setStages(data.stages.slice(0, i + 1));
      await new Promise(r => setTimeout(r, 350));
    }

    setResult({ approved: data.approved, authCode: data.authCode, atmFee: data.atmFee, totalDebited: data.totalDebited, reason: data.reason });
    setProcessing(false);
  }

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 24 }}>
        <Link href="/live" style={{ fontSize: 12, color: "#9ca3af" }}>← Back to scenarios</Link>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: "#111827", margin: "8px 0 4px" }}>ATM Withdrawal</h1>
        <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>Insert card, enter PIN, withdraw cash. See PIN encryption, balance check, auth hold, and ledger entries.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20, alignItems: "start" }}>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>

          {/* ATM terminal visual */}
          <div style={{ background: "#111827", borderRadius: 8, padding: 16, textAlign: "center" }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "#4b5563", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 8px" }}>ATM TERMINAL</p>
            <p style={{ fontSize: 13, color: "#9ca3af", margin: 0, lineHeight: 1.5 }}>{atm.location}</p>
            <p style={{ fontSize: 10, color: "#4b5563", margin: "4px 0 0", fontFamily: "monospace" }}>{atm.id}</p>
          </div>

          <div>
            <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 6 }}>ATM location</label>
            {ATM_LOCATIONS.map((a) => (
              <button key={a.id} onClick={() => setAtm(a)}
                style={{ width: "100%", padding: "6px 10px", fontSize: 11, textAlign: "left", border: "1px solid", borderRadius: 4, cursor: "pointer", marginBottom: 4,
                  borderColor: atm.id === a.id ? "#111827" : "#e5e7eb",
                  background: atm.id === a.id ? "#f9fafb" : "#fff", color: "#374151",
                }}>
                {a.location}
              </button>
            ))}
          </div>

          <div>
            <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 6 }}>Card</label>
            {TEST_CARDS.map((c) => (
              <button key={c.pan} onClick={() => set("pan", c.pan)}
                style={{ width: "100%", padding: "6px 10px", fontSize: 11, textAlign: "left", border: "1px solid", borderRadius: 4, cursor: "pointer", marginBottom: 4,
                  borderColor: form.pan === c.pan ? "#111827" : "#e5e7eb",
                  background: form.pan === c.pan ? "#f9fafb" : "#fff", color: "#374151",
                }}>
                <div style={{ fontFamily: "monospace" }}>{c.pan}</div>
                <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 1 }}>{c.label}</div>
              </button>
            ))}
          </div>

          {[
            { label: "Expiry (MM/YY)", key: "expiry", placeholder: "12/28" },
            { label: "PIN", key: "pin", placeholder: "1234", type: "password" },
          ].map(f => (
            <div key={f.key}>
              <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>{f.label}</label>
              <input type={f.type ?? "text"} value={form[f.key as keyof typeof form]} onChange={(e) => set(f.key, e.target.value)} placeholder={f.placeholder}
                maxLength={f.key === "pin" ? 4 : undefined}
                style={{ width: "100%", padding: "7px 10px", fontSize: 12, border: "1px solid #e5e7eb", borderRadius: 4, fontFamily: "monospace", boxSizing: "border-box", letterSpacing: f.key === "pin" ? "0.3em" : "normal" }} />
            </div>
          ))}

          <div>
            <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 6 }}>Withdrawal amount</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
              {AMOUNTS.map((a) => (
                <button key={a} onClick={() => set("amount", a)}
                  style={{ padding: "8px 0", fontSize: 12, fontWeight: 500, border: "1px solid", borderRadius: 4, cursor: "pointer",
                    borderColor: form.amount === a ? "#111827" : "#e5e7eb",
                    background: form.amount === a ? "#111827" : "#fff",
                    color: form.amount === a ? "#fff" : "#374151",
                  }}>
                  ${a}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 6 }}>
              <input type="number" value={form.amount} onChange={(e) => set("amount", e.target.value)} placeholder="Other amount"
                style={{ width: "100%", padding: "7px 10px", fontSize: 12, border: "1px solid #e5e7eb", borderRadius: 4, boxSizing: "border-box" }} />
            </div>
          </div>

          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 4, padding: 10 }}>
            <p style={{ fontSize: 11, color: "#92400e", margin: 0 }}> ATM surcharge: $2.50 for foreign card withdrawals</p>
          </div>

          <button onClick={handleSubmit} disabled={processing}
            style={{ padding: "10px 0", fontSize: 13, fontWeight: 600, background: processing ? "#9ca3af" : "#111827", color: "#fff", border: "none", borderRadius: 4, cursor: processing ? "not-allowed" : "pointer" }}>
            {processing ? "Processing..." : `Withdraw $${form.amount}`}
          </button>

          {result && (
            <div style={{ padding: 12, borderRadius: 4, textAlign: "center", background: result.approved ? "#f0fdf4" : "#fef2f2", border: `1px solid ${result.approved ? "#bbf7d0" : "#fecaca"}` }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: result.approved ? "#15803d" : "#dc2626", margin: 0 }}>
                {result.approved ? " Cash dispensed" : " Transaction declined"}
              </p>
              {result.approved && result.totalDebited && (
                <p style={{ fontSize: 11, color: "#6b7280", margin: "4px 0 0" }}>
                  Total debited: ${(result.totalDebited/100).toFixed(2)} (incl. ${(result.atmFee!/100).toFixed(2)} fee)
                </p>
              )}
              {result.authCode && <p style={{ fontSize: 11, color: "#6b7280", margin: "2px 0 0", fontFamily: "monospace" }}>Auth: {result.authCode}</p>}
              {result.reason && <p style={{ fontSize: 11, color: "#dc2626", margin: "4px 0 0" }}>{result.reason}</p>}
            </div>
          )}
        </div>

        <div>
          {stages.length === 0 && !processing ? (
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6, padding: 48, textAlign: "center" }}>
              
              <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>Select an ATM, insert your card, enter PIN and amount to see the full ATM authorization flow</p>
            </div>
          ) : (
            <StageWizard stages={stages} currentStageIndex={currentStageIndex} processing={processing} />
          )}
        </div>
      </div>
    </div>
  );
}
