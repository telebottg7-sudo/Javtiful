import React from "react";
import { NavView, BackendStatus } from "../../types";
import { ShieldCheck, GitBranch, Menu, PanelLeftOpen, PanelLeftClose } from "lucide-react";

interface HeaderProps {
  currentView: NavView;
  status: BackendStatus | null;
  onOpenMobileSidebar: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const titles: Record<NavView, { title: string; subtitle: string }> = {
  home: {
    title: "Home & System Status",
    subtitle: "Overview of GitHub repository storage, directory schema, and quick access.",
  },
  search: {
    title: "Metadata Search",
    subtitle: "Fast index-driven search across video codes, actresses, and studios.",
  },
  "bulk-scraper": {
    title: "Bulk Scraper",
    subtitle: "Automated ingestion pipeline with deterministic code normalization and batch commits.",
  },
  actress: {
    title: "Actress Catalog",
    subtitle: "Browse and manage actress records sharded under database/pstar/.",
  },
  studio: {
    title: "Studio Catalog",
    subtitle: "Browse and manage studio records sharded under database/studio/.",
  },
  code: {
    title: "Global Code Index",
    subtitle: "Unique video codes registry deduplicated across database/index/codes.json.",
  },
  videos: {
    title: "Video Catalog",
    subtitle: "Browse aggregated video metadata index database/index/videos.json.",
  },
    maintenance: {
    title: "Database Maintenance & Validation",
    subtitle: "Schema verification, duplicate code detection, orphan resolution, and index rebuild.",
  },
  "system-tests": {
    title: "System Test Suites",
    subtitle: "Automated verification for pipelines, sharding, search, and data integrity.",
  },
};

export const Header: React.FC<HeaderProps> = ({
  currentView,
  status,
  onOpenMobileSidebar,
  isCollapsed,
  onToggleCollapse,
}) => {
  const meta = titles[currentView] || { title: currentView, subtitle: "" };

  return (
    <header className="h-16 bg-white border-b border-neutral-200 px-4 sm:px-6 flex items-center justify-between shrink-0 gap-3">
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile Hamburger Toggle */}
        <button
          onClick={onOpenMobileSidebar}
          aria-label="Open navigation menu"
          className="md:hidden p-2 rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Desktop Sidebar Collapse Toggle */}
        <button
          onClick={onToggleCollapse}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label="Toggle sidebar width"
          className="hidden md:flex p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
        >
          {isCollapsed ? (
            <PanelLeftOpen className="w-4 h-4" />
          ) : (
            <PanelLeftClose className="w-4 h-4" />
          )}
        </button>

        <div className="min-w-0">
          <h1 className="text-sm sm:text-base font-semibold text-neutral-900 leading-tight truncate">
            {meta.title}
          </h1>
          <p className="text-[11px] sm:text-xs text-neutral-500 mt-0.5 truncate hidden sm:block">
            {meta.subtitle}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-neutral-100 border border-neutral-200 text-xs font-mono text-neutral-600">
          <GitBranch className="w-3.5 h-3.5 text-neutral-500" />
          <span>{status?.repo.branch || "main"}</span>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-neutral-100 border border-neutral-200 text-xs text-neutral-700">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span className="font-mono text-[11px] sm:text-xs">
            <span className="hidden sm:inline">GitHub JSON </span>Store
          </span>
        </div>
      </div>
    </header>
  );
};
