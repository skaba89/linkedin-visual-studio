"use client";

import { useAppStore } from "@/store/appStore";
import {
  BarChart3,
  FileText,
  TrendingUp,
  Users,
  MessageSquare,
  CalendarCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Shield,
} from "lucide-react";

export default function MonitoringView() {
  const { metrics, agents } = useAppStore();

  const benchmarks = [
    { label: "Posts publiés", value: metrics.postsPublished, target: "5/semaine", met: metrics.postsPublished >= 5 },
    { label: "Impressions moy.", value: metrics.impressionsMoy.toLocaleString(), target: "2 000+", met: metrics.impressionsMoy >= 2000 },
    { label: "Taux engagement", value: `${metrics.tauxEngagement}%`, target: "3%+", met: metrics.tauxEngagement >= 3 },
    { label: "Profils collectés", value: metrics.profilsCollectes.toString(), target: "—", met: true },
    { label: "Leads qualifiés", value: metrics.leadsQualifies.toString(), target: "20-40/sem", met: metrics.leadsQualifies >= 20 },
    { label: "Taux qualif.", value: `${Math.round((metrics.leadsQualifies / metrics.profilsCollectes) * 100)}%`, target: "15-25%", met: true },
    { label: "Messages envoyés", value: metrics.messagesEnvoyes.toString(), target: "—", met: true },
    { label: "Taux réponse", value: `${metrics.tauxReponse}%`, target: "20-35%", met: metrics.tauxReponse >= 20 },
    { label: "RDVs générés", value: metrics.rdvsGeneres.toString(), target: "8-12/sem", met: metrics.rdvsGeneres >= 8 },
  ];

  const complianceRules = [
    { label: "Messages limités à 30-50/jour", met: true },
    { label: "Uniquement connexions 1er degré", met: true },
    { label: "Mécanisme de désabonnement intégré", met: true },
    { label: "RGPD : suppression après 90 jours", met: false },
    { label: "Pas de contact sans interaction préalable", met: true },
    { label: "Pas de message commercial au 1er contact", met: true },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-[#F0F4F8] tracking-[-0.5px]">Monitoring</h1>
        <p className="text-sm text-[#7B8A9A] mt-1">Suivez les métriques clés et la conformité LinkedIn en temps réel</p>
      </div>

      {/* Agent Status Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {agents.map((agent) => (
          <div key={agent.id} className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[10px] text-[#7B8A9A] tracking-[1px]">{agent.num}</span>
              <div className={`w-2 h-2 rounded-full ${
                agent.status === "active" ? "bg-[#00C48C] animate-pulse" :
                agent.status === "paused" ? "bg-[#F4A100]" :
                agent.status === "error" ? "bg-[#E5263A]" : "bg-[#7B8A9A]"
              }`} />
            </div>
            <h3 className="text-sm font-semibold text-[#F0F4F8]">{agent.name}</h3>
            <p className="text-[11px] text-[#7B8A9A] mt-1">{agent.role}</p>
          </div>
        ))}
      </div>

      {/* Benchmarks Table */}
      <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <h3 className="text-sm font-semibold text-[#F0F4F8]">Métriques vs Benchmarks</h3>
        </div>
        <div className="divide-y divide-white/[0.03]">
          {benchmarks.map((b, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-3">
                {b.met ? (
                  <CheckCircle2 className="w-4 h-4 text-[#00C48C]" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-[#F4A100]" />
                )}
                <span className="text-[13px] text-[#F0F4F8]">{b.label}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-mono text-sm font-medium text-[#F0F4F8]">{b.value}</span>
                <span className="text-[11px] text-[#7B8A9A]">/ {b.target}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Two columns: Compliance + Weekly breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Compliance */}
        <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-[#00D4FF]" />
            <h3 className="text-sm font-semibold text-[#F0F4F8]">Conformité LinkedIn</h3>
          </div>
          <div className="space-y-2">
            {complianceRules.map((rule, i) => (
              <div key={i} className="flex items-center gap-2.5 text-[13px]">
                {rule.met ? (
                  <CheckCircle2 className="w-4 h-4 text-[#00C48C] flex-shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-[#E5263A] flex-shrink-0" />
                )}
                <span className={rule.met ? "text-[#7B8A9A]" : "text-[#E5263A]"}>{rule.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Data format reference */}
        <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[#F0F4F8] mb-3">Format data/qualified.json</h3>
          <pre className="bg-[#080C10] border border-white/[0.06] rounded-lg p-4 text-[12px] leading-relaxed text-[#F0F4F8] font-mono overflow-x-auto">
{`[
  {
    "id": "linkedin_abc123",
    "prenom": "Marie",
    "poste": "CMO",
    "entreprise": "Startup SaaS B2B",
    "score": 82,
    "action": "commented",
    "post_sujet": "automation LinkedIn",
    "statut": "new"
  }
]`}
          </pre>
          <p className="text-[11px] text-[#7B8A9A] mt-2">
            Le statut progresse : new → contacted → replied → booked
          </p>
        </div>
      </div>
    </div>
  );
}
