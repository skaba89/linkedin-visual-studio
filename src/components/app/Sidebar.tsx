"use client";

import { useAppStore, type ViewType } from "@/store/appStore";
import {
  LayoutDashboard,
  Wrench,
  Bot,
  Target,
  MessageSquare,
  Users,
  BarChart3,
  Settings,
  ChevronRight,
  Zap,
  Linkedin,
  Radio,
  Mail,
  Building2,
  GitBranch,
  Bell,
  Globe,
} from "lucide-react";

const navItems: { id: ViewType; label: string; icon: React.ElementType; section?: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "setup", label: "Installation", icon: Wrench, section: "CONFIG" },
  { id: "agent-contenu", label: "Agent Contenu", icon: Bot, section: "AGENTS" },
  { id: "agent-qualif", label: "Agent Qualification", icon: Bot },
  { id: "agent-prospection", label: "Agent Prospection", icon: Bot },
  { id: "agent-engagement", label: "Agent Engagement", icon: Bot },
  { id: "agent-veille", label: "Agent Veille", icon: Bot },
  { id: "agent-nurturing", label: "Agent Nurturing", icon: Bot },
  { id: "agent-analyse", label: "Agent Analyse", icon: Bot },
  { id: "agent-reseau", label: "Agent Réseau", icon: Bot },
  { id: "icp", label: "ICP & Scoring", icon: Target, section: "DATA" },
  { id: "leads", label: "Leads qualifiés", icon: Users },
  { id: "crm", label: "CRM & Pipeline", icon: Building2 },
  { id: "templates", label: "Templates messages", icon: MessageSquare },
  { id: "linkedin", label: "LinkedIn", icon: Linkedin, section: "CANAUX" },
  { id: "email", label: "Email", icon: Mail },
  { id: "monitoring", label: "Monitoring", icon: BarChart3, section: "SYSTÈME" },
  { id: "orchestrator", label: "Orchestrateur", icon: Radio },
  { id: "analytics", label: "Analytics & ROI", icon: BarChart3 },
  { id: "workflows", label: "Automatisations", icon: GitBranch, section: "AUTOMATISATION" },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "integrations", label: "Intégrations", icon: Globe },
  { id: "settings", label: "Paramètres", icon: Settings },
];

export default function Sidebar() {
  const { currentView, setCurrentView, agents, linkedInConnected } = useAppStore();

  const getStatusColor = (agentId: string) => {
    const agent = agents.find((a) => a.id === agentId);
    if (!agent) return "bg-[#6B7280]";
    switch (agent.status) {
      case "active":
        return "bg-[#00C48C]";
      case "paused":
        return "bg-[#F4A100]";
      case "error":
        return "bg-[#E5263A]";
      default:
        return "bg-[#6B7280]";
    }
  };

  const getAgentId = (viewId: ViewType): string | null => {
    if (viewId.startsWith("agent-")) {
      return viewId.replace("agent-", "").replace("qualif", "qualif");
    }
    return null;
  };

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[240px] bg-[#0A0E14] border-r border-white/[0.06] z-50 flex flex-col overflow-hidden">
      {/* Logo */}
      <div className="px-5 h-16 flex items-center gap-3 border-b border-white/[0.06]">
        <div className="relative">
          <svg viewBox="0 0 36 48" fill="none" className="h-7 w-auto">
            <rect x="0" y="28" width="7" height="16" rx="2" fill="#00D4FF" />
            <rect x="11" y="18" width="7" height="26" rx="2" fill="#00D4FF" />
            <rect x="22" y="8" width="7" height="36" rx="2" fill="#00D4FF" />
            <path d="M3.5 28 Q16 4 25.5 8" stroke="#00D4FF" strokeWidth="1.5" fill="none" opacity="0.4" />
          </svg>
        </div>
        <div>
          <div className="text-[#F0F4F8] text-sm font-semibold tracking-[-0.3px]">HERMÈS</div>
          <div className="text-[#7B8A9A] text-[9px] font-medium tracking-[2px] uppercase">Dashboard</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {navItems.map((item) => (
          <div key={item.id}>
            {item.section && (
              <div className="text-[10px] font-semibold tracking-[1.5px] text-[#7B8A9A]/60 uppercase px-3 mb-2 mt-5 first:mt-0">
                {item.section}
              </div>
            )}
            <button
              onClick={() => setCurrentView(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 mb-0.5 cursor-pointer ${
                currentView === item.id
                  ? "bg-[#00D4FF]/10 text-[#00D4FF]"
                  : "text-[#7B8A9A] hover:text-[#F0F4F8] hover:bg-white/[0.04]"
              }`}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              <span className="truncate flex-1 text-left">{item.label}</span>
              {getAgentId(item.id) && (
                <div className={`w-1.5 h-1.5 rounded-full ${getStatusColor(getAgentId(item.id)!)}`} />
              )}
              {item.id === "linkedin" && (
                <div className={`w-1.5 h-1.5 rounded-full ${linkedInConnected ? "bg-[#00C48C]" : "bg-[#6B7280]"}`} />
              )}
              {currentView === item.id && (
                <ChevronRight className="w-3.5 h-3.5 opacity-50" />
              )}
            </button>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-2 text-[11px] text-[#7B8A9A]">
          <Zap className="w-3 h-3 text-[#00D4FF]" />
          <span>{agents.length} agents configurés</span>
        </div>
      </div>
    </aside>
  );
}
