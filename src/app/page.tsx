"use client";

import { useAppStore } from "@/store/appStore";
import Sidebar from "@/components/app/Sidebar";
import DashboardView from "@/components/app/DashboardView";
import SetupView from "@/components/app/SetupView";
import AgentDetailView from "@/components/app/AgentDetailView";
import ICPView from "@/components/app/ICPView";
import LeadsView from "@/components/app/LeadsView";
import TemplatesView from "@/components/app/TemplatesView";
import MonitoringView from "@/components/app/MonitoringView";
import SettingsView from "@/components/app/SettingsView";
import LinkedInView from "@/components/app/LinkedInView";
import { Menu, X } from "lucide-react";
import { useState, useEffect } from "react";
import { useAgentSimulation } from "@/hooks/useAgentSimulation";

export default function Home() {
  const { currentView, setCurrentView, setLinkedInConnected } = useAppStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [linkedInError, setLinkedInError] = useState<string | null>(null);

  // Run agent simulation in the background
  useAgentSimulation();

  // Handle LinkedIn OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const linkedInStatus = params.get("linkedin");

    if (linkedInStatus === "connected") {
      setLinkedInConnected(true);
      setCurrentView("linkedin");
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (linkedInStatus === "error") {
      const errorMessage = params.get("message") || "Erreur lors de la connexion LinkedIn";
      setLinkedInError(decodeURIComponent(errorMessage));
      setCurrentView("linkedin");
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [setLinkedInConnected, setCurrentView]);

  const renderView = () => {
    switch (currentView) {
      case "dashboard":
        return <DashboardView />;
      case "setup":
        return <SetupView />;
      case "agent-contenu":
        return <AgentDetailView agentId="contenu" />;
      case "agent-qualif":
        return <AgentDetailView agentId="qualif" />;
      case "agent-prospection":
        return <AgentDetailView agentId="prospection" />;
      case "agent-engagement":
        return <AgentDetailView agentId="engagement" />;
      case "agent-veille":
        return <AgentDetailView agentId="veille" />;
      case "agent-nurturing":
        return <AgentDetailView agentId="nurturing" />;
      case "agent-analyse":
        return <AgentDetailView agentId="analyse" />;
      case "agent-reseau":
        return <AgentDetailView agentId="reseau" />;
      case "icp":
        return <ICPView />;
      case "leads":
        return <LeadsView />;
      case "templates":
        return <TemplatesView />;
      case "monitoring":
        return <MonitoringView />;
      case "settings":
        return <SettingsView />;
      case "linkedin":
        return <LinkedInView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="min-h-screen bg-[#080C10] text-white">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative z-10 w-[240px]">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="lg:ml-[240px]">
        {/* Mobile Header */}
        <div className="lg:hidden sticky top-0 z-40 bg-[#0A0E14]/95 backdrop-blur-xl border-b border-white/[0.06] px-4 h-14 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-[#F0F4F8] hover:text-[#00D4FF] transition-colors cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 36 48" fill="none" className="h-6 w-auto">
              <rect x="0" y="28" width="7" height="16" rx="2" fill="#00D4FF" />
              <rect x="11" y="18" width="7" height="26" rx="2" fill="#00D4FF" />
              <rect x="22" y="8" width="7" height="36" rx="2" fill="#00D4FF" />
            </svg>
            <span className="text-sm font-semibold text-[#F0F4F8]">HERMÈS</span>
          </div>
          <div className="w-5" />
        </div>

        {/* LinkedIn Error Banner */}
        {linkedInError && (
          <div className="mx-4 sm:mx-6 lg:mx-8 mt-4 flex items-center gap-3 text-[13px] text-[#E5263A] bg-[#E5263A]/10 border border-[#E5263A]/20 rounded-xl px-4 py-3">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
            <span className="flex-1">{linkedInError}</span>
            <button onClick={() => setLinkedInError(null)} className="text-[#7B8A9A] hover:text-[#F0F4F8] cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Content */}
        <main className="p-4 sm:p-6 lg:p-8 max-w-[1200px]">
          {renderView()}
        </main>
      </div>
    </div>
  );
}
