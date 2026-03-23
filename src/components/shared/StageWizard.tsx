"use client";

import { useState } from "react";

export interface Stage {
  id: string;
  label: string;
  status: "pending" | "processing" | "success" | "failed" | "warning";
  duration?: number;
  customer: string;
  system: {
    title: string;
    fields: { label: string; value: string; sensitive?: boolean }[];
    note: string;
  };
}

interface Props {
  stages: Stage[];
  currentStageIndex: number;
  processing: boolean;
}

const STATUS_COLOR: Record<string, string> = {
  pending:    "#d1d5db",
  processing: "#6b7280",
  success:    "#15803d",
  failed:     "#dc2626",
  warning:    "#ca8a04",
};

const STATUS_LABEL: Record<string, string> = {
  pending:    "—",
  processing: "...",
  success:    "OK",
  failed:     "FAIL",
  warning:    "WARN",
};

export default function StageWizard({ stages, currentStageIndex, processing }: Props) {
  const [selectedStage, setSelectedStage] = useState<Stage | null>(null);
  const displayed = selectedStage ?? stages[Math.max(0, currentStageIndex)];

  if (stages.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Stage progress */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6, padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", overflowX: "auto", paddingBottom: 2, gap: 0 }}>
          {stages.map((stage, i) => (
            <div key={stage.id} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
              <button
                onClick={() => setSelectedStage(stage)}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                  padding: "6px 12px", borderRadius: 4, cursor: "pointer", minWidth: 80,
                  background: displayed?.id === stage.id ? "#f9fafb" : "transparent",
                  border: displayed?.id === stage.id ? "1px solid #e5e7eb" : "1px solid transparent",
                }}
              >
                {/* Status indicator */}
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: "0.05em",
                  color: "#fff",
                  background: STATUS_COLOR[stage.status],
                  borderRadius: 3, padding: "1px 5px",
                  minWidth: 28, textAlign: "center",
                  animation: stage.status === "processing" ? "pulse 1s ease-in-out infinite" : "none",
                }}>
                  {STATUS_LABEL[stage.status]}
                </span>
                <span style={{ fontSize: 10, color: "#6b7280", textAlign: "center", lineHeight: 1.3 }}>
                  {stage.label}
                </span>
                {stage.duration && stage.status !== "pending" && (
                  <span style={{ fontSize: 9, color: "#9ca3af" }}>{stage.duration}ms</span>
                )}
              </button>
              {i < stages.length - 1 && (
                <div style={{
                  width: 20, height: 1, flexShrink: 0,
                  background: stages[i + 1]?.status === "pending" ? "#e5e7eb" : "#9ca3af",
                }} />
              )}
            </div>
          ))}
          {processing && (
            <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 12, flexShrink: 0 }}>
              Processing...
            </span>
          )}
        </div>
      </div>

      {/* Split view */}
      {displayed && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

          {/* Customer view */}
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6, overflow: "hidden" }}>
            <div style={{ padding: "8px 16px", borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
              <p style={{ fontSize: 10, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
                Customer view
              </p>
            </div>
            <div style={{
              padding: 24, minHeight: 200,
              display: "flex", flexDirection: "column",
              justifyContent: "center", alignItems: "center", gap: 14,
            }}>
              {/* Status badge */}
              <div style={{
                padding: "4px 14px", borderRadius: 4,
                background: displayed.status === "success" ? "#f0fdf4"
                  : displayed.status === "failed"  ? "#fef2f2"
                  : displayed.status === "warning" ? "#fffbeb"
                  : "#f9fafb",
                border: `1px solid ${STATUS_COLOR[displayed.status]}20`,
              }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
                  color: STATUS_COLOR[displayed.status],
                }}>
                  {STATUS_LABEL[displayed.status]}
                </span>
              </div>

              <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", margin: 0, textAlign: "center" }}>
                {displayed.label}
              </p>
              <p style={{ fontSize: 13, color: "#6b7280", margin: 0, textAlign: "center", whiteSpace: "pre-line", lineHeight: 1.7 }}>
                {displayed.customer}
              </p>

              {displayed.status === "processing" && (
                <div style={{ display: "flex", gap: 5 }}>
                  {[0, 1, 2].map((i) => (
                    <span key={i} style={{
                      width: 5, height: 5, borderRadius: "50%",
                      background: "#9ca3af",
                      animation: `pulse 1s ease-in-out ${i * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* System internals */}
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6, overflow: "hidden" }}>
            <div style={{ padding: "8px 16px", borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
              <p style={{ fontSize: 10, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
                System internals
              </p>
            </div>
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#111827", margin: 0 }}>
                {displayed.system.title}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {displayed.system.fields.map((f) => (
                  <div key={f.label} style={{ display: "flex", gap: 8, fontSize: 11, alignItems: "flex-start" }}>
                    <span style={{ color: "#9ca3af", flexShrink: 0, width: 140, fontFamily: "monospace", paddingTop: 1 }}>
                      {f.label}
                    </span>
                    <span style={{ color: "#374151", fontFamily: "monospace", wordBreak: "break-all", whiteSpace: "pre-line", flex: 1 }}>
                      {f.sensitive ? `${String(f.value).slice(0, 4)}...` : f.value}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{
                borderTop: "1px solid #f3f4f6", paddingTop: 10,
                fontSize: 11, color: "#6b7280", lineHeight: 1.6,
              }}>
                {displayed.system.note}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
