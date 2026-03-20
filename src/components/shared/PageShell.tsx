"use client";

import { RefreshCw } from "lucide-react";
import clsx from "clsx";

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
  title, subtitle, lastRefresh, refreshing, onRefresh,
  tabs, activeTab, onTabChange, children,
}: Props) {
  return (
    <div className="px-8 py-8 max-w-7xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-base font-semibold text-gray-900">{title}</h1>
          <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">{lastRefresh.toLocaleTimeString()}</span>
          <button onClick={onRefresh} disabled={refreshing}
            className="flex items-center gap-1.5 bg-white border border-gray-200 rounded px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            <RefreshCw className={clsx("h-3 w-3", refreshing && "animate-spin")} /> Refresh
          </button>
        </div>
      </div>
      <div className="flex gap-0 mb-5 border-b border-gray-200">
        {tabs.map((t) => (
          <button key={t} onClick={() => onTabChange(t)}
            className={clsx("px-4 py-2 text-xs font-medium border-b-2 -mb-px transition-colors",
              activeTab === t ? "border-gray-900 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-600"
            )}>
            {t}
          </button>
        ))}
      </div>
      {children}
    </div>
  );
}
