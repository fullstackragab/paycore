"use client";

import { useState } from "react";
import Link from "next/link";
import StageWizard, { Stage } from "@/components/shared/StageWizard";

const MERCHANTS = [
  { name: "Carrefour", mcc: "5411" },
  { name: "Walmart",   mcc: "5411" },
  { name: "Starbucks", mcc: "5812" },
  { name: "Shell",     mcc: "5541" },
  { name: "IKEA",      mcc: "5712" },
  { name: "H&M",       mcc: "5621" },
];

const TEST_CARDS = [
  { pan: "4111 1111 1111 1111", label: "Visa — always approved" },
  { pan: "5500 0000 0000 0004", label: "Mastercard — always approved" },
  { pan: "3714 496353 98431",   label: "Amex — always approved" },
  { pan: "4000 0000 0000 0002", label: "Visa — will decline" },
];

export default function POSPage() {
  const [form, setForm] = useState({
    pan: "4111 1111 1111 1111", expiry: "12/28", cvv: "123",
    amount: "85.00", merchantName: "Carrefour", merchantMCC: "5411",
    isContactless: true,
  });
  const [stages, setStages] = useState<Stage[]>([]);
  const [processing, setProcessing] = useState(false);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [result, setResult] = useState<{ approved: boolean; authCode?: string; reason?: string } | null>(null);

  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit() {
    setStages([]);
    setResult(null);
    setCurrentStageIndex(0);
    setProcessing(true);

    const res = await fetch("/api/live/pos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();

    // Animate stages one by one
    for (let i = 0; i < data.stages.length; i++) {
      setCurrentStageIndex(i);
      setStages(data.stages.slice(0, i + 1));
      await new Promise(r => setTimeout(r, 200));
    }

    setResult({ approved: data.approved, authCode: data.authCode, reason: data.declineReason });
    setProcessing(false);
  }

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 24 }}>
        <Link href="/live" style={{ fontSize: 12, color: "#9ca3af" }}>← Back to scenarios</Link>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: "#111827", margin: "8px 0 4px" }}>
          Supermarket POS Payment
        </h1>
        <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>
          Simulate a card payment at a supermarket terminal. Watch the ISO 8583 authorization flow in real time.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20, alignItems: "start" }}>
        {/* Input form */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#111827", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>Payment details</p>

          {/* Test card picker */}
          <div>
            <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 6 }}>Test card</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {TEST_CARDS.map((c) => (
                <button key={c.pan} onClick={() => set("pan", c.pan)}
                  style={{ padding: "6px 10px", fontSize: 11, textAlign: "left", border: "1px solid", borderRadius: 4, cursor: "pointer",
                    borderColor: form.pan === c.pan ? "#111827" : "#e5e7eb",
                    background: form.pan === c.pan ? "#f9fafb" : "#fff",
                    color: "#374151",
                  }}>
                  <div style={{ fontFamily: "monospace", fontSize: 11 }}>{c.pan}</div>
                  <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 1 }}>{c.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Card fields */}
          {[
            { label: "Card number", key: "pan", placeholder: "4111 1111 1111 1111" },
            { label: "Expiry (MM/YY)", key: "expiry", placeholder: "12/28" },
            { label: "CVV", key: "cvv", placeholder: "123" },
          ].map(f => (
            <div key={f.key}>
              <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>{f.label}</label>
              <input value={form[f.key as keyof typeof form] as string}
                onChange={(e) => set(f.key, e.target.value)}
                placeholder={f.placeholder}
                style={{ width: "100%", padding: "8px 10px", fontSize: 12, border: "1px solid #e5e7eb", borderRadius: 4, fontFamily: f.key === "pan" || f.key === "cvv" ? "monospace" : "inherit", boxSizing: "border-box" }}
              />
            </div>
          ))}

          {/* Merchant */}
          <div>
            <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Merchant</label>
            <select value={form.merchantName}
              onChange={(e) => {
                const m = MERCHANTS.find(m => m.name === e.target.value)!;
                set("merchantName", m.name);
                set("merchantMCC", m.mcc);
              }}
              style={{ width: "100%", padding: "8px 10px", fontSize: 12, border: "1px solid #e5e7eb", borderRadius: 4, boxSizing: "border-box" }}>
              {MERCHANTS.map(m => <option key={m.name} value={m.name}>{m.name} (MCC {m.mcc})</option>)}
            </select>
          </div>

          {/* Amount */}
          <div>
            <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Amount (USD)</label>
            <input type="number" value={form.amount} onChange={(e) => set("amount", e.target.value)} step="0.01"
              style={{ width: "100%", padding: "8px 10px", fontSize: 12, border: "1px solid #e5e7eb", borderRadius: 4, boxSizing: "border-box" }} />
          </div>

          {/* Entry method */}
          <div>
            <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 6 }}>Entry method</label>
            <div style={{ display: "flex", gap: 8 }}>
              {[true, false].map((v) => (
                <button key={String(v)} onClick={() => set("isContactless", v)}
                  style={{ flex: 1, padding: "8px 0", fontSize: 12, border: "1px solid", borderRadius: 4, cursor: "pointer",
                    borderColor: form.isContactless === v ? "#111827" : "#e5e7eb",
                    background: form.isContactless === v ? "#111827" : "#fff",
                    color: form.isContactless === v ? "#fff" : "#374151",
                  }}>
                  {v ? " Tap" : " Chip"}
                </button>
              ))}
            </div>
          </div>

          <button onClick={handleSubmit} disabled={processing}
            style={{ padding: "10px 0", fontSize: 13, fontWeight: 600, background: processing ? "#9ca3af" : "#111827", color: "#fff", border: "none", borderRadius: 4, cursor: processing ? "not-allowed" : "pointer" }}>
            {processing ? "Processing..." : `Pay $${form.amount}`}
          </button>

          {result && (
            <div style={{
              padding: 12, borderRadius: 4, textAlign: "center",
              background: result.approved ? "#f0fdf4" : "#fef2f2",
              border: `1px solid ${result.approved ? "#bbf7d0" : "#fecaca"}`,
            }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: result.approved ? "#15803d" : "#dc2626", margin: 0 }}>
                {result.approved ? " Approved" : " Declined"}
              </p>
              {result.authCode && <p style={{ fontSize: 11, color: "#6b7280", margin: "4px 0 0", fontFamily: "monospace" }}>Auth: {result.authCode}</p>}
              {result.reason && <p style={{ fontSize: 11, color: "#dc2626", margin: "4px 0 0" }}>{result.reason}</p>}
            </div>
          )}
        </div>

        {/* Wizard */}
        <div>
          {stages.length === 0 && !processing ? (
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6, padding: 48, textAlign: "center" }}>
              
              <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>
                Fill in the payment details and click Pay to see the full authorization flow
              </p>
            </div>
          ) : (
            <StageWizard stages={stages} currentStageIndex={currentStageIndex} processing={processing} />
          )}
        </div>
      </div>
    </div>
  );
}
