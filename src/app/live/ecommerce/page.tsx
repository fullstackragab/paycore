"use client";

import { useState } from "react";
import Link from "next/link";
import StageWizard, { Stage } from "@/components/shared/StageWizard";

const PRODUCTS = [
  { name: "Sony WH-1000XM5 Headphones", price: "279.99", merchant: "Amazon" },
  { name: "Apple AirPods Pro",           price: "249.00", merchant: "Apple Store" },
  { name: "Nike Air Max 270",            price: "150.00", merchant: "Nike" },
  { name: "MacBook Pro 14\" M3",         price: "1999.00", merchant: "Apple Store" },
  { name: "Monthly Subscription",        price: "12.99",   merchant: "Netflix" },
];

const TEST_CARDS = [
  { pan: "4111 1111 1111 1111", label: "Visa — approved + 3DS" },
  { pan: "5500 0000 0000 0004", label: "Mastercard — approved" },
  { pan: "4000 0000 0000 0002", label: "Visa — will decline" },
];

export default function EcommercePage() {
  const [product, setProduct] = useState(PRODUCTS[0]);
  const [form, setForm] = useState({
    pan: "4111 1111 1111 1111", expiry: "12/28", cvv: "123",
    cardholderName: "John Mitchell", billingZip: "10001",
  });
  const [stages, setStages] = useState<Stage[]>([]);
  const [processing, setProcessing] = useState(false);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [result, setResult] = useState<{ approved: boolean; authCode?: string; token?: string; reason?: string } | null>(null);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit() {
    setStages([]); setResult(null); setCurrentStageIndex(0); setProcessing(true);

    const res = await fetch("/api/live/ecommerce", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, amount: product.price, merchantName: product.merchant }),
    });
    const data = await res.json();

    for (let i = 0; i < data.stages.length; i++) {
      setCurrentStageIndex(i);
      setStages(data.stages.slice(0, i + 1));
      await new Promise(r => setTimeout(r, 300));
    }

    setResult({ approved: data.approved, authCode: data.authCode, token: data.token, reason: data.reason });
    setProcessing(false);
  }

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 24 }}>
        <Link href="/live" style={{ fontSize: 12, color: "#9ca3af" }}>← Back to scenarios</Link>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: "#111827", margin: "8px 0 4px" }}>Online Checkout</h1>
        <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>Card-not-present payment with tokenization and 3-D Secure. Watch what happens behind the checkout form.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20, alignItems: "start" }}>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#111827", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>Checkout</p>

          <div>
            <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 6 }}>Product</label>
            {PRODUCTS.map((p) => (
              <button key={p.name} onClick={() => setProduct(p)}
                style={{ width: "100%", padding: "8px 10px", fontSize: 11, textAlign: "left", border: "1px solid", borderRadius: 4, cursor: "pointer", marginBottom: 4,
                  borderColor: product.name === p.name ? "#111827" : "#e5e7eb",
                  background: product.name === p.name ? "#f9fafb" : "#fff", color: "#374151",
                }}>
                <div style={{ fontWeight: 500 }}>{p.name}</div>
                <div style={{ color: "#9ca3af", marginTop: 1 }}>${p.price} · {p.merchant}</div>
              </button>
            ))}
          </div>

          <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 14 }}>
            <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 6 }}>Test card</label>
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
            { label: "Card number", key: "pan" },
            { label: "Expiry (MM/YY)", key: "expiry" },
            { label: "CVV", key: "cvv" },
            { label: "Cardholder name", key: "cardholderName" },
            { label: "Billing ZIP", key: "billingZip" },
          ].map(f => (
            <div key={f.key}>
              <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>{f.label}</label>
              <input value={form[f.key as keyof typeof form]} onChange={(e) => set(f.key, e.target.value)}
                style={{ width: "100%", padding: "7px 10px", fontSize: 12, border: "1px solid #e5e7eb", borderRadius: 4, fontFamily: ["pan","cvv"].includes(f.key) ? "monospace" : "inherit", boxSizing: "border-box" }} />
            </div>
          ))}

          <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 4, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, color: "#111827" }}>
              <span>Total</span>
              <span>${product.price}</span>
            </div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{product.merchant}</div>
          </div>

          <button onClick={handleSubmit} disabled={processing}
            style={{ padding: "10px 0", fontSize: 13, fontWeight: 600, background: processing ? "#9ca3af" : "#111827", color: "#fff", border: "none", borderRadius: 4, cursor: processing ? "not-allowed" : "pointer" }}>
            {processing ? "Processing..." : `Pay $${product.price}`}
          </button>

          {result && (
            <div style={{ padding: 12, borderRadius: 4, textAlign: "center", background: result.approved ? "#f0fdf4" : "#fef2f2", border: `1px solid ${result.approved ? "#bbf7d0" : "#fecaca"}` }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: result.approved ? "#15803d" : "#dc2626", margin: 0 }}>
                {result.approved ? " Order confirmed" : " Payment failed"}
              </p>
              {result.authCode && <p style={{ fontSize: 11, color: "#6b7280", margin: "4px 0 0", fontFamily: "monospace" }}>Auth: {result.authCode}</p>}
              {result.token && <p style={{ fontSize: 10, color: "#9ca3af", margin: "4px 0 0", fontFamily: "monospace" }}>Token: {result.token.slice(0, 20)}...</p>}
              {result.reason && <p style={{ fontSize: 11, color: "#dc2626", margin: "4px 0 0" }}>{result.reason}</p>}
            </div>
          )}
        </div>

        <div>
          {stages.length === 0 && !processing ? (
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6, padding: 48, textAlign: "center" }}>
              
              <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>Select a product and click Pay to see tokenization, 3DS, and authorization</p>
            </div>
          ) : (
            <StageWizard stages={stages} currentStageIndex={currentStageIndex} processing={processing} />
          )}
        </div>
      </div>
    </div>
  );
}
