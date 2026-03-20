"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  CreditCard, Building2, Globe, ShieldAlert,
  BarChart3, Scale, LayoutDashboard, Activity,
} from "lucide-react";

const NAV = [
  { label: "Overview",       href: "/",              icon: LayoutDashboard, live: true  },
  { label: "Card Payments",  href: "/card",          icon: CreditCard,      live: true,  phase: 1 },
  { label: "Bank Transfers", href: "/bank",          icon: Building2,       live: true,  phase: 2 },
  { label: "Cross-Border",   href: "/crossborder",   icon: Globe,           live: true,  phase: 3 },
  { label: "Risk & Fraud",   href: "/risk",          icon: ShieldAlert,     live: true,  phase: 4 },
  { label: "Reconciliation", href: "/reconciliation",icon: BarChart3,       live: true,  phase: 5 },
  { label: "Compliance",     href: "/compliance",    icon: Scale,           live: true,  phase: 6 },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-52 border-r border-gray-200 bg-white flex flex-col z-30">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-gray-200">
        <Activity className="h-4 w-4 text-gray-900" />
        <div>
          <p className="text-sm font-semibold text-gray-900 leading-none tracking-tight">PayCore</p>
          <p className="text-[10px] text-gray-400 mt-0.5 tracking-wide uppercase">Payments OS</p>
        </div>
      </div>

      {/* Live indicator */}
      <div className="flex items-center gap-1.5 px-4 py-2 border-b border-gray-100">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
        <span className="text-[10px] text-gray-400 uppercase tracking-wide">Simulation running</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {NAV.map((item) => {
          const Icon = item.icon;
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

          return (
            <Link key={item.href} href={item.live ? item.href : "#"}
              className={clsx(
                "flex items-center gap-2.5 rounded px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-gray-900 text-white"
                  : item.live
                  ? "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  : "text-gray-300 cursor-not-allowed"
              )}>
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
              {!item.live && item.phase && (
                <span className="text-[10px] text-gray-300">P{item.phase}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-100">
        <p className="text-[10px] text-gray-300 leading-relaxed">
          Full-lifecycle payments platform. Six domains. Live simulation.
        </p>
      </div>
    </aside>
  );
}
