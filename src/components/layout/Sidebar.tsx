import React from "react";
import {
  Home,
  Search,
  Layers,
  Users,
  Building2,
  Hash,
  Film,
  Database,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  X,
  Wrench,
  ShieldCheck,
} from "lucide-react";
import { NavView, BackendStatus } from "../../types";

interface SidebarProps {
  currentView: NavView;
  onNavigate: (view: NavView) => void;
  status: BackendStatus | null;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

interface NavItemConfig {
  id: NavView;
  label: string;
  icon: React.ElementType;
  badge?: string;
  description: string;
}

const navItems: NavItemConfig[] = [
  { id: "home", label: "Home", icon: Home, description: "Overview & repository status" },
  { id: "search", label: "Search", icon: Search, description: "Find by code, actress, or studio" },
  { id: "bulk-scraper", label: "Bulk Scraper", icon: Layers, description: "Batch ingest & deduplicate" },
  { id: "actress", label: "Actress", icon: Users, description: "database/pstar/* catalog" },
  { id: "studio", label: "Studio", icon: Building2, description: "database/studio/* catalog" },
  { id: "code", label: "Code", icon: Hash, description: "database/index/codes.json" },
  { id: "videos", label: "Videos", icon: Film, description: "database/index/videos.json" },
  { id: "maintenance", label: "Maintenance", icon: Wrench, description: "Validation & index rebuild" },
  { id: "system-tests", label: "System Tests", icon: ShieldCheck, description: "Automated test suites" },
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  status,
  isCollapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}) => {
  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-neutral-900/40 backdrop-blur-xs z-40 md:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 bg-white border-r border-neutral-200 flex flex-col shrink-0 h-full transition-all duration-200 ease-in-out ${
          isCollapsed ? "md:w-16" : "md:w-64"
        } ${
          mobileOpen
            ? "translate-x-0 w-64 shadow-xl"
            : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-3 border-b border-neutral-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-neutral-900 text-white flex items-center justify-center font-bold text-sm tracking-wider shrink-0">
              AV
            </div>
            {(!isCollapsed || mobileOpen) && (
              <div className="truncate">
                <div className="font-semibold text-neutral-900 text-sm leading-tight flex items-center gap-1.5">
                  Avdb
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 border border-neutral-200">
                    v0.1
                  </span>
                </div>
                <div className="text-xs text-neutral-500 font-mono mt-0.5 truncate">
                  database/
                </div>
              </div>
            )}
          </div>

          {/* Desktop Collapse Button */}
          <button
            onClick={onToggleCollapse}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden md:flex p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>

          {/* Mobile Close Button */}
          <button
            onClick={onCloseMobile}
            className="md:hidden p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto overflow-x-hidden">
          {(!isCollapsed || mobileOpen) && (
            <div className="px-3 py-1.5 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
              Navigation
            </div>
          )}
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                title={isCollapsed && !mobileOpen ? item.label : undefined}
                onClick={() => {
                  onNavigate(item.id);
                  if (mobileOpen) onCloseMobile();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                  isActive
                    ? "bg-neutral-900 text-white shadow-xs"
                    : "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900"
                } ${isCollapsed && !mobileOpen ? "justify-center px-0" : ""}`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? "text-white" : "text-neutral-500"
                  }`}
                />
                {(!isCollapsed || mobileOpen) && (
                  <>
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                          isActive
                            ? "bg-neutral-800 text-neutral-300"
                            : "bg-neutral-100 text-neutral-600"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </nav>

        {/* Target Storage Info Footer */}
        <div className="p-2 border-t border-neutral-200 bg-neutral-50/70 shrink-0">
          {(!isCollapsed || mobileOpen) ? (
            <div className="p-2.5 rounded-lg border border-neutral-200 bg-white text-xs space-y-2">
              <div className="flex items-center justify-between text-neutral-600">
                <span className="flex items-center gap-1.5 font-medium text-neutral-900">
                  <Database className="w-3.5 h-3.5 text-neutral-700" />
                  GitHub Storage
                </span>
                {status?.githubConfigured ? (
                  <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                    <CheckCircle2 className="w-3 h-3" /> Ready
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[11px] text-amber-600 font-medium">
                    <AlertCircle className="w-3 h-3" /> No Token
                  </span>
                )}
              </div>
              <div className="font-mono text-[11px] text-neutral-500 break-all leading-tight">
                {status?.repo
                  ? `${status.repo.owner}/${status.repo.repo}`
                  : "telebottg7-sudo/Avdb"}
              </div>
              <div className="flex items-center justify-between text-[11px] text-neutral-400 font-mono pt-1 border-t border-neutral-100">
                <span>branch: {status?.repo.branch || "main"}</span>
                <span>root: {status?.repo.root || "database"}/</span>
              </div>
            </div>
          ) : (
            <div
              title={
                status?.githubConfigured
                  ? "GitHub Store Ready: telebottg7-sudo/Avdb"
                  : "GitHub Store: No Token"
              }
              className="flex justify-center p-2 rounded-lg hover:bg-neutral-200/50 cursor-pointer"
            >
              {status?.githubConfigured ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-600" />
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
