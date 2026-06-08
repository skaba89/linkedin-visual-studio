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
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { useAgentSimulation } from "@/hooks/useAgentSimulation";

export default function Home() {
  const { currentView } = useAppStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Run agent simulation in the background
  useAgentSimulation();

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

        {/* Content */}
        <main className="p-4 sm:p-6 lg:p-8 max-w-[1200px]">
          {renderView()}
        </main>
      </div>
    </div>
  );
}
