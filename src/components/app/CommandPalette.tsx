"use client";

/**
 * HERMÈS — Command Palette (Cmd+K)
 *
 * Press Cmd+K (or Ctrl+K) anywhere in the app to open a fuzzy-search palette
 * that lets you jump to any view in 2 keystrokes. Premium UX win — every
 * modern SaaS has this (Linear, Notion, Raycast, Vercel).
 *
 * Uses cmdk (already a dependency) + our existing Sidebar navItems.
 *
 * Future: extend with action commands (create lead, schedule post, etc).
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useAppStore, type ViewType } from "@/store/appStore";
import {
  LayoutDashboard,
  Wrench,
  Bot,
  Target,
  Users,
  Building2,
  MessageSquare,
  Linkedin,
  Mail,
  BarChart3,
  Radio,
  GitBranch,
  Bell,
  Globe,
  Settings,
  Search,
  Sparkles,
  CreditCard,
  type LucideIcon,
} from "lucide-react";

interface NavItem {
  id: ViewType;
  label: string;
  icon: LucideIcon;
  section: string;
  keywords?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, section: "Navigation", keywords: "accueil home" },
  { id: "setup", label: "Installation", icon: Wrench, section: "Navigation" },
  { id: "agent-contenu", label: "Agent Contenu", icon: Bot, section: "Agents", keywords: "rédaction posts publication" },
  { id: "agent-qualif", label: "Agent Qualification", icon: Bot, section: "Agents", keywords: "scoring leads enrichissement" },
  { id: "agent-prospection", label: "Agent Prospection", icon: Bot, section: "Agents", keywords: "invitations messages" },
  { id: "agent-engagement", label: "Agent Engagement", icon: Bot, section: "Agents", keywords: "likes commentaires" },
  { id: "agent-veille", label: "Agent Veille", icon: Bot, section: "Agents", keywords: "trends marché surveiller" },
  { id: "agent-nurturing", label: "Agent Nurturing", icon: Bot, section: "Agents", keywords: "suivi long-terme tièdes" },
  { id: "agent-analyse", label: "Agent Analyse", icon: Bot, section: "Agents", keywords: "performance insights" },
  { id: "agent-reseau", label: "Agent Réseau", icon: Bot, section: "Agents", keywords: "croissance réseau" },
  { id: "icp", label: "ICP & Scoring", icon: Target, section: "Data", keywords: "icp ideal customer profile" },
  { id: "leads", label: "Leads qualifiés", icon: Users, section: "Data", keywords: "prospects" },
  { id: "crm", label: "CRM & Pipeline", icon: Building2, section: "Data", keywords: "deals opportunités" },
  { id: "templates", label: "Templates messages", icon: MessageSquare, section: "Data" },
  { id: "linkedin", label: "LinkedIn", icon: Linkedin, section: "Canaux" },
  { id: "email", label: "Email", icon: Mail, section: "Canaux" },
  { id: "monitoring", label: "Monitoring", icon: BarChart3, section: "Système" },
  { id: "orchestrator", label: "Orchestrateur", icon: Radio, section: "Système" },
  { id: "analytics", label: "Analytics & ROI", icon: BarChart3, section: "Système", keywords: "roi coût" },
  { id: "workflows", label: "Automatisations", icon: GitBranch, section: "Automatisation", keywords: "workflows" },
  { id: "notifications", label: "Notifications", icon: Bell, section: "Système" },
  { id: "integrations", label: "Intégrations", icon: Globe, section: "Système", keywords: "webhooks slack discord" },
  { id: "engagement", label: "Engagement IA", icon: Sparkles, section: "Intelligence", keywords: "réacteurs tendances commentaires" },
  { id: "billing", label: "Facturation", icon: CreditCard, section: "Intelligence", keywords: "plan abonnement stripe usage quota" },
  { id: "settings", label: "Paramètres", icon: Settings, section: "Système", keywords: "config" },
];

// Group items by section for display
const SECTIONS = Array.from(new Set(NAV_ITEMS.map((i) => i.section)));

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const setCurrentView = useAppStore((s) => s.setCurrentView);
  // router is unused for now — kept for future deep-link commands
  const _router = useRouter();
  void _router;

  // Global keyboard shortcut: Cmd+K (mac) / Ctrl+K (win/linux)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleSelect = (view: ViewType) => {
    setCurrentView(view);
    setOpen(false);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Recherche rapide"
      description="Tapez pour naviguer dans HERMÈS…"
    >
      <CommandInput placeholder="Rechercher une vue, un agent, un canal…" />
      <CommandList className="max-h-[400px]">
        <CommandEmpty>Aucun résultat.</CommandEmpty>
        {SECTIONS.map((section, idx) => (
          <div key={section}>
            <CommandGroup heading={section}>
              {NAV_ITEMS.filter((i) => i.section === section).map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${item.label} ${item.keywords ?? ""}`}
                  onSelect={() => handleSelect(item.id)}
                  className="cursor-pointer"
                >
                  <item.icon className="w-4 h-4 text-[#7B8A9A] mr-2" />
                  <span className="text-[#F0F4F8]">{item.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            {idx < SECTIONS.length - 1 && <CommandSeparator />}
          </div>
        ))}
      </CommandList>
    </CommandDialog>
  );
}

/**
 * Floating "Cmd+K" trigger button — rendered in the Sidebar header so
 * the user discovers the feature without reading docs.
 */
export function CommandPaletteTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md bg-[#0F1520] hover:bg-[#18212F] border border-white/[0.06] hover:border-white/[0.1] text-[12px] text-[#7B8A9A] hover:text-[#F0F4F8] transition-colors cursor-pointer"
      title="Recherche rapide (Cmd+K)"
    >
      <Search className="w-3.5 h-3.5" />
      <span className="flex-1 text-left">Recherche rapide</span>
      <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#080C10] border border-white/[0.06] text-[#7B8A9A]">
        ⌘K
      </kbd>
    </button>
  );
}
