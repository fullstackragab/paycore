"use client";

import { RefreshCw } from "lucide-react";
import TimeDisplay from "@/components/ui/TimeDisplay";

interface Props {
  title: string;
  subtitle: string;
  lastRefresh: Date;
  refreshing: boolean;
  onRefresh: () => void;
  tabs: readonly string[];
  activeTab: string;
  onTabChange: (t: string) => void;
  children: React.ReactNode;
}

export default function PageShell({
  title,
  subtitle,
  lastRefresh,
  refreshing,
  onRefresh,
  tabs,
  activeTab,
  onTabChange,
  children,
}: Props) {
  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 24,
          gap: 16,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "#111827",
              margin: 0,
            }}
          >
            {title}
          </h1>
          <p style={{ fontSize: 11, color: "#9ca3af", margin: "4px 0 0" }}>
            {subtitle}
          </p>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexShrink: 0,
          }}
        >
          <TimeDisplay date={lastRefresh} />{" "}
          <button
            onClick={onRefresh}
            disabled={refreshing}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 5,
              padding: "5px 12px",
              fontSize: 11,
              color: "#6b7280",
              cursor: "pointer",
              opacity: refreshing ? 0.5 : 1,
            }}
          >
            <RefreshCw size={11} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid #e5e7eb",
          marginBottom: 24,
          gap: 0,
        }}
      >
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => onTabChange(t)}
            style={{
              padding: "8px 16px",
              fontSize: 12,
              fontWeight: 500,
              border: "none",
              borderBottom:
                activeTab === t ? "2px solid #111827" : "2px solid transparent",
              background: "none",
              color: activeTab === t ? "#111827" : "#9ca3af",
              cursor: "pointer",
              marginBottom: -1,
              transition: "color 0.1s",
              whiteSpace: "nowrap",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {children}
    </div>
  );
}
