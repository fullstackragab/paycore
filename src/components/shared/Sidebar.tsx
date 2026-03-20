"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  CreditCard,
  Building2,
  Globe,
  ShieldAlert,
  BarChart3,
  Scale,
  LayoutDashboard,
  Activity,
} from "lucide-react";

const NAV = [
  {
    label: "Overview",
    href: "/",
    icon: LayoutDashboard,
    live: true,
  },
  {
    label: "Card Payments",
    href: "/card",
    icon: CreditCard,
    live: true,
    phase: 1,
  },
  {
    label: "Bank Transfers",
    href: "/bank",
    icon: Building2,
    live: false,
    phase: 2,
  },
  {
    label: "Cross-Border",
    href: "/crossborder",
    icon: Globe,
    live: false,
    phase: 3,
  },
  {
    label: "Risk & Fraud",
    href: "/risk",
    icon: ShieldAlert,
    live: false,
    phase: 4,
  },
  {
    label: "Reconciliation",
    href: "/reconciliation",
    icon: BarChart3,
    live: false,
    phase: 5,
  },
  {
    label: "Compliance",
    href: "/compliance",
    icon: Scale,
    live: false,
    phase: 6,
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-56 border-r border-slate-200 bg-white flex flex-col z-30">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-slate-200">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900">
          <Activity className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900 leading-none">PayCore</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Payments OS</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {NAV.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.live ? item.href : "#"}
              className={clsx(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-slate-900 text-white"
                  : item.live
                  ? "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  : "text-slate-400 cursor-not-allowed"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
              {item.live && !isActive && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                </span>
              )}
              {!item.live && item.phase && (
                <span className="text-[10px] font-medium text-slate-400">
                  P{item.phase}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-slate-200">
        <p className="text-[10px] text-slate-400 leading-relaxed">
          Production-grade payments platform. Built to demonstrate full-lifecycle
          expertise across all payment domains.
        </p>
      </div>
    </aside>
  );
}
