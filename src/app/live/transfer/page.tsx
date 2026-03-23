"use client";

import { useState } from "react";
import Link from "next/link";
import StageWizard, { Stage } from "@/components/shared/StageWizard";

const CORRIDORS = [
  {
    label: "USA → Egypt",
    sendCurrency: "USD",
    receiveCurrency: "EGP",
    receiverCountry: "EG",
    receiverBank: "CIB Egypt",
    receiverBIC: "CIBEEGCX",
  },
  {
    label: "USA → UAE",
    sendCurrency: "USD",
    receiveCurrency: "AED",
    receiverCountry: "AE",
    receiverBank: "Emirates NBD",
    receiverBIC: "EBILAEAD",
  },
  {
    label: "USA → India",
    sendCurrency: "USD",
    receiveCurrency: "INR",
    receiverCountry: "IN",
    receiverBank: "HDFC Bank",
    receiverBIC: "HDFCINBB",
  },
  {
    label: "USA → UK",
    sendCurrency: "USD",
    receiveCurrency: "GBP",
    receiverCountry: "GB",
    receiverBank: "Barclays",
    receiverBIC: "BARCGB22",
  },
  {
    label: "USA → Nigeria",
    sendCurrency: "USD",
    receiveCurrency: "NGN",
    receiverCountry: "NG",
    receiverBank: "Zenith Bank",
    receiverBIC: "ZEIBNGLA",
  },
  {
    label: "EUR → USA",
    sendCurrency: "EUR",
    receiveCurrency: "USD",
    receiverCountry: "US",
    receiverBank: "Chase",
    receiverBIC: "CHASUS33",
  },
];

const PURPOSE_CODES = [
  { code: "SALA", label: "Salary payment" },
  { code: "SUPP", label: "Supplier payment" },
  { code: "TRAD", label: "Trade settlement" },
  { code: "SVCS", label: "Services" },
  { code: "REFU", label: "Refund" },
];

export default function TransferPage() {
  const [corridor, setCorridor] = useState(CORRIDORS[0]);
  const [form, setForm] = useState({
    senderName: "John Mitchell",
    senderIBAN: "US29CHAS0000000012345678",
    senderBank: "JPMorgan Chase",
    receiverName: "Omar Haddad",
    receiverIBAN: "EG380019000500000000263180002",
    amount: "1000.00",
    purposeCode: "SALA",
    reference: "Salary March 2026",
  });

  const [stages, setStages] = useState<Stage[]>([]);
  const [processing, setProcessing] = useState(false);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [result, setResult] = useState<{
    approved: boolean;
    blocked?: boolean;
    reason?: string;
    receiveAmount?: number;
    receiveCurrency?: string;
  } | null>(null);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function selectCorridor(c: (typeof CORRIDORS)[0]) {
    setCorridor(c);
    setForm((f) => ({ ...f, receiverBank: c.receiverBank }));
  }

  async function handleSubmit() {
    setStages([]);
    setResult(null);
    setCurrentStageIndex(0);
    setProcessing(true);

    const res = await fetch("/api/live/transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        sendCurrency: corridor.sendCurrency,
        receiveCurrency: corridor.receiveCurrency,
        receiverCountry: corridor.receiverCountry,
        receiverBank: corridor.receiverBank,
      }),
    });
    const data = await res.json();

    for (let i = 0; i < data.stages.length; i++) {
      setCurrentStageIndex(i);
      setStages(data.stages.slice(0, i + 1));
      await new Promise((r) => setTimeout(r, 300));
    }

    setResult({
      approved: data.approved,
      blocked: data.blocked,
      reason: data.reason,
      receiveAmount: data.receiveAmount,
      receiveCurrency: data.receiveCurrency,
    });
    setProcessing(false);
  }

  return (
    <div style={{ maxWidth: 1100, width: "100%" }}>
      <div style={{ marginBottom: 24 }}>
        <Link href="/live" style={{ fontSize: 12, color: "#9ca3af" }}>
          ← Back to scenarios
        </Link>
        <h1
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: "#111827",
            margin: "8px 0 4px",
          }}
        >
          🌍 Overseas Bank Transfer
        </h1>
        <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>
          Send money internationally via SWIFT. Watch KYC, FX conversion, MT103
          construction, and correspondent routing.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "300px 1fr",
          gap: 20,
          alignItems: "start",
        }}
      >
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 6,
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#111827",
              margin: 0,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Transfer details
          </p>

          {/* Corridor selector */}
          <div>
            <label
              style={{
                fontSize: 11,
                color: "#6b7280",
                display: "block",
                marginBottom: 6,
              }}
            >
              Corridor
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {CORRIDORS.map((c) => (
                <button
                  key={c.label}
                  onClick={() => selectCorridor(c)}
                  style={{
                    padding: "6px 10px",
                    fontSize: 11,
                    textAlign: "left",
                    border: "1px solid",
                    borderRadius: 4,
                    cursor: "pointer",
                    borderColor:
                      corridor.label === c.label ? "#111827" : "#e5e7eb",
                    background: corridor.label === c.label ? "#f9fafb" : "#fff",
                    color: "#374151",
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{c.label}</span>
                  <span style={{ color: "#9ca3af", marginLeft: 6 }}>
                    {c.sendCurrency} → {c.receiveCurrency}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {[
            { label: "Sender name", key: "senderName" },
            { label: "Sender IBAN", key: "senderIBAN" },
            { label: "Receiver name", key: "receiverName" },
            { label: "Receiver IBAN", key: "receiverIBAN" },
          ].map((f) => (
            <div key={f.key}>
              <label
                style={{
                  fontSize: 11,
                  color: "#6b7280",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                {f.label}
              </label>
              <input
                value={form[f.key as keyof typeof form]}
                onChange={(e) => set(f.key, e.target.value)}
                style={{
                  width: "100%",
                  padding: "7px 10px",
                  fontSize: 11,
                  border: "1px solid #e5e7eb",
                  borderRadius: 4,
                  fontFamily: f.key.includes("IBAN") ? "monospace" : "inherit",
                  boxSizing: "border-box",
                }}
              />
            </div>
          ))}

          <div>
            <label
              style={{
                fontSize: 11,
                color: "#6b7280",
                display: "block",
                marginBottom: 4,
              }}
            >
              Amount ({corridor.sendCurrency})
            </label>
            <input
              type="number"
              value={form.amount}
              onChange={(e) => set("amount", e.target.value)}
              step="0.01"
              style={{
                width: "100%",
                padding: "7px 10px",
                fontSize: 12,
                border: "1px solid #e5e7eb",
                borderRadius: 4,
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label
              style={{
                fontSize: 11,
                color: "#6b7280",
                display: "block",
                marginBottom: 4,
              }}
            >
              Purpose code
            </label>
            <select
              value={form.purposeCode}
              onChange={(e) => set("purposeCode", e.target.value)}
              style={{
                width: "100%",
                padding: "7px 10px",
                fontSize: 12,
                border: "1px solid #e5e7eb",
                borderRadius: 4,
                boxSizing: "border-box",
              }}
            >
              {PURPOSE_CODES.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.code} — {p.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              style={{
                fontSize: 11,
                color: "#6b7280",
                display: "block",
                marginBottom: 4,
              }}
            >
              Reference
            </label>
            <input
              value={form.reference}
              onChange={(e) => set("reference", e.target.value)}
              style={{
                width: "100%",
                padding: "7px 10px",
                fontSize: 12,
                border: "1px solid #e5e7eb",
                borderRadius: 4,
                boxSizing: "border-box",
              }}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={processing}
            style={{
              padding: "10px 0",
              fontSize: 13,
              fontWeight: 600,
              background: processing ? "#9ca3af" : "#111827",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              cursor: processing ? "not-allowed" : "pointer",
            }}
          >
            {processing
              ? "Sending..."
              : `Send ${corridor.sendCurrency} ${form.amount}`}
          </button>

          {result && (
            <div
              style={{
                padding: 12,
                borderRadius: 4,
                textAlign: "center",
                background: result.approved ? "#f0fdf4" : "#fef2f2",
                border: `1px solid ${result.approved ? "#bbf7d0" : "#fecaca"}`,
              }}
            >
              <p
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: result.approved ? "#15803d" : "#dc2626",
                  margin: 0,
                }}
              >
                {result.approved
                  ? "✓ Transfer sent"
                  : result.blocked
                    ? "⚠ Blocked"
                    : "✗ Failed"}
              </p>
              {result.receiveAmount && (
                <p
                  style={{ fontSize: 12, color: "#6b7280", margin: "4px 0 0" }}
                >
                  Recipient receives: {result.receiveCurrency}{" "}
                  {(result.receiveAmount / 100).toFixed(2)}
                </p>
              )}
              {result.reason && (
                <p
                  style={{ fontSize: 11, color: "#dc2626", margin: "4px 0 0" }}
                >
                  {result.reason}
                </p>
              )}
            </div>
          )}
        </div>

        <div>
          {stages.length === 0 && !processing ? (
            <div
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 6,
                padding: 48,
                textAlign: "center",
              }}
            >
              <p style={{ fontSize: 24, margin: "0 0 12px" }}>🌍</p>
              <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>
                Fill in the transfer details and click Send to see the full
                SWIFT flow
              </p>
            </div>
          ) : (
            <StageWizard
              stages={stages}
              currentStageIndex={currentStageIndex}
              processing={processing}
            />
          )}
        </div>
      </div>
    </div>
  );
}
