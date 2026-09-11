import React, { useState, useEffect } from "react";
import { NavView, BackendStatus } from "./types";
import { Sidebar } from "./components/layout/Sidebar";
import { Header } from "./components/layout/Header";
import { HomeView } from "./components/views/HomeView";
import { SearchView } from "./components/views/SearchView";
import { BulkScraperView } from "./components/views/BulkScraperView";
import { ActressView } from "./components/views/ActressView";
import { StudioView } from "./components/views/StudioView";
import { CodeView } from "./components/views/CodeView";
import { VideosView } from "./components/views/VideosView";
import { MaintenanceView } from "./components/views/MaintenanceView";
import { SystemTestsView } from "./components/views/SystemTestsView";

export default function App() {
  const [currentView, setCurrentView] = useState<NavView>("home");
  const [status, setStatus] = useState<BackendStatus | null>(null);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);

  useEffect(() => {
    fetch("/api/config/status")
      .then((res) => res.json())
      .then((data: BackendStatus) => {
        setStatus(data);
      })
      .catch((err) => {
        console.error("Failed to fetch backend status:", err);
      });
  }, []);

  const renderView = () => {
    switch (currentView) {
      case "home":
        return <HomeView status={status} onNavigate={setCurrentView} />;
      case "search":
        return <SearchView onNavigate={setCurrentView} />;
      case "bulk-scraper":
        return <BulkScraperView onNavigate={setCurrentView} />;
      case "actress":
        return <ActressView onNavigate={setCurrentView} />;
      case "studio":
        return <StudioView onNavigate={setCurrentView} />;
      case "code":
        return <CodeView onNavigate={setCurrentView} />;
      case "videos":
        return <VideosView onNavigate={setCurrentView} />;
      case "maintenance":
        return <MaintenanceView />;
      case "system-tests":
        return <SystemTestsView />;
      default:
        return <HomeView status={status} onNavigate={setCurrentView} />;
    }
  };

  return (
    <div className="flex h-screen w-screen bg-neutral-50 text-neutral-900 overflow-hidden font-sans">
      {/* Collapsible & Mobile Responsive Left Sidebar */}
      <Sidebar
        currentView={currentView}
        onNavigate={setCurrentView}
        status={status}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed((prev) => !prev)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Header
          currentView={currentView}
          status={status}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed((prev) => !prev)}
          onOpenMobileSidebar={() => setMobileOpen(true)}
        />
        <main className="flex-1 overflow-y-auto min-w-0">
          {renderView()}
        </main>
      </div>
    </div>
  );
}
