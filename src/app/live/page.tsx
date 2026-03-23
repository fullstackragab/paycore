"use client";

import Link from "next/link";

const SCENARIOS = [
  {
    href: "/live/pos",
    tag: "POS",
    label: "Supermarket POS",
    desc: "Customer taps card at checkout. Watch the authorization request travel from terminal through the card network to the issuing bank and back in under 3 seconds.",
    stages: ["Card read", "Auth request (ISO 8583)", "Risk scoring", "Issuer decision", "Receipt"],
    time: "~3 seconds",
    rail: "Visa / Mastercard",
  },
  {
    href: "/live/ecommerce",
    tag: "WEB",
    label: "Online Checkout",
    desc: "Customer pays on an e-commerce site. Includes tokenization, 3-D Secure challenge, authorization, and capture — with the full message flow visible.",
    stages: ["Card entry", "Tokenization", "3DS challenge", "Authorization", "Capture"],
    time: "~10 seconds",
    rail: "Card network + 3DS",
  },
  {
    href: "/live/transfer",
    tag: "SWIFT",
    label: "Overseas Bank Transfer",
    desc: "User sends money from their mobile banking app to a beneficiary abroad. Watch KYC check, FX conversion, SWIFT MT103 construction, correspondent routing, and final credit.",
    stages: ["Initiation", "KYC / sanctions", "FX conversion", "SWIFT MT103", "Correspondent", "Credit"],
    time: "T+1 to T+2",
    rail: "SWIFT",
  },
  {
    href: "/live/atm",
    tag: "ATM",
    label: "ATM Withdrawal",
    desc: "Customer inserts card and requests cash. Includes PIN verification, balance check, authorization hold, cash dispensed, and ledger update.",
    stages: ["Card inserted", "PIN verify", "Balance check", "Auth hold", "Cash dispensed", "Ledger update"],
    time: "~5 seconds",
    rail: "Visa / Mastercard",
  },
];

export default function LivePage() {
  return (
    <div style={{ maxWidth: 900, width: "100%" }}>
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>
          PayCore Live
        </p>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: "#111827", margin: "0 0 6px" }}>
          End-to-end payment scenarios
        </h1>
        <p style={{ fontSize: 13, color: "#6b7280", margin: 0, maxWidth: 560, lineHeight: 1.6 }}>
          Real payment flows with real internal mechanics. Fill in the inputs,
          hit pay, and watch each stage process — customer view on the left,
          system internals on the right.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 }}>
        {SCENARIOS.map((s) => (
          <Link key={s.href} href={s.href}>
            <div style={{
              background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6,
              padding: 24, cursor: "pointer", height: "100%",
              display: "flex", flexDirection: "column", gap: 16,
              boxSizing: "border-box", transition: "border-color 0.15s",
            }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#374151")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}
            >
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: "#374151",
                  background: "#f3f4f6", border: "1px solid #e5e7eb",
                  borderRadius: 3, padding: "3px 8px", letterSpacing: "0.08em",
                }}>
                  {s.tag}
                </span>
                <span style={{
                  fontSize: 10, color: "#9ca3af",
                  background: "#f9fafb", border: "1px solid #f3f4f6",
                  borderRadius: 3, padding: "2px 8px",
                }}>
                  {s.rail}
                </span>
              </div>

              {/* Title + desc */}
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#111827", margin: "0 0 6px" }}>{s.label}</p>
                <p style={{ fontSize: 12, color: "#6b7280", margin: 0, lineHeight: 1.6 }}>{s.desc}</p>
              </div>

              {/* Stages */}
              <div style={{ marginTop: "auto" }}>
                <p style={{ fontSize: 10, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>Stages</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
                  {s.stages.map((stage, i) => (
                    <span key={stage} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 11, color: "#374151", background: "#f3f4f6", borderRadius: 3, padding: "2px 6px" }}>
                        {stage}
                      </span>
                      {i < s.stages.length - 1 && (
                        <span style={{ fontSize: 10, color: "#d1d5db" }}>→</span>
                      )}
                    </span>
                  ))}
                </div>
                <p style={{ fontSize: 11, color: "#9ca3af", margin: "10px 0 0" }}>
                  {s.time}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
