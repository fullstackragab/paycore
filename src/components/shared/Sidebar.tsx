"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CreditCard, Building2, Globe, ShieldAlert,
  BarChart3, Scale, LayoutDashboard, Activity,
} from "lucide-react";

const NAV = [
  { label: "Overview",       href: "/",               icon: LayoutDashboard },
  { label: "Card Payments",  href: "/card",            icon: CreditCard      },
  { label: "Bank Transfers", href: "/bank",            icon: Building2       },
  { label: "Cross-Border",   href: "/crossborder",     icon: Globe           },
  { label: "Risk & Fraud",   href: "/risk",            icon: ShieldAlert     },
  { label: "Reconciliation", href: "/reconciliation",  icon: BarChart3       },
  { label: "Compliance",     href: "/compliance",      icon: Scale           },
];

const SIDEBAR_W = 220;

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside style={{
      position: "fixed", top: 0, left: 0, bottom: 0,
      width: SIDEBAR_W,
      background: "#ffffff",
      borderRight: "1px solid #e5e7eb",
      display: "flex", flexDirection: "column",
      zIndex: 40,
      overflowY: "auto",
    }}>
      {/* Logo */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 10 }}>
        <Activity size={15} color="#111827" />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", lineHeight: 1 }}>PayCore</div>
          <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.06em" }}>Payments OS</div>
        </div>
      </div>

      {/* Live indicator */}
      <div style={{ padding: "8px 20px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#16a34a", display: "inline-block" }} className="animate-pulse" />
        <span style={{ fontSize: 10, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>Simulation running</span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "10px 10px" }}>
        {NAV.map((item) => {
          const Icon = item.icon;
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} style={{
              display: "flex", alignItems: "center", gap: 9,
              padding: "8px 10px",
              borderRadius: 5,
              marginBottom: 2,
              fontSize: 13,
              fontWeight: isActive ? 500 : 400,
              color: isActive ? "#ffffff" : "#6b7280",
              background: isActive ? "#111827" : "transparent",
              transition: "background 0.1s, color 0.1s",
            }}
              onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = "#f3f4f6"; e.currentTarget.style.color = "#111827"; } }}
              onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#6b7280"; } }}
            >
              <Icon size={14} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: "12px 20px", borderTop: "1px solid #f3f4f6" }}>
        <p style={{ fontSize: 10, color: "#d1d5db", lineHeight: 1.5, margin: 0 }}>
          Full-lifecycle payments platform.<br />Six domains. Live simulation.
        </p>
      </div>
    </aside>
  );
}
