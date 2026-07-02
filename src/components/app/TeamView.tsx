"use client";

/**
 * HERMÈS — Phase 4.4 — TeamView
 *
 * Team workspaces management UI:
 *   1. Current workspace indicator + switcher (Personal vs workspaces)
 *   2. Create workspace button (modal)
 *   3. Members list with role badges + remove/change role actions
 *   4. Invite member form (email + role selector)
 *   5. Pending invitations list with revoke + copy invite link
 *
 * Premium UX:
 *   - Role badges color-coded (admin=cyan, member=green, viewer=gray)
 *   - Smooth transitions when switching workspaces
 *   - Copy-to-clipboard for invite links
 *   - Empty state with helpful copy
 *   - Plan-gated feature (Business+ required)
 */

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Plus,
  Trash2,
  Crown,
  Shield,
  Eye,
  UserPlus,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  Building2,
  User,
  X,
} from "lucide-react";
import { toast } from "@/lib/toast";
import type { WorkspaceRole } from "@/lib/workspaces";

interface Workspace {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  role: WorkspaceRole;
  memberCount: number;
  createdAt: string;
}

interface Member {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: WorkspaceRole;
  joinedAt: string;
}

interface Invitation {
  id: string;
  email: string;
  role: WorkspaceRole;
  token: string;
  expiresAt: string;
  status: string;
  createdAt: string;
}

const ROLE_CONFIG: Record<WorkspaceRole, { label: string; icon: typeof Crown; color: string; bg: string }> = {
  admin: { label: "Admin", icon: Shield, color: "text-[#00D4FF]", bg: "bg-[#00D4FF]/10 border-[#00D4FF]/30" },
  member: { label: "Membre", icon: Users, color: "text-[#00C48C]", bg: "bg-[#00C48C]/10 border-[#00C48C]/30" },
  viewer: { label: "Lecteur", icon: Eye, color: "text-[#7B8A9A]", bg: "bg-[#7B8A9A]/10 border-[#7B8A9A]/30" },
};

export default function TeamView() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [current, setCurrent] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [creating, setCreating] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", role: "member" as WorkspaceRole });
  const [inviting, setInviting] = useState(false);

  const fetchWorkspaces = useCallback(async () => {
    try {
      const res = await fetch("/api/workspaces");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setWorkspaces(data.workspaces ?? []);
      setCurrent(data.current ?? null);
    } catch {
      // ignore
    }
  }, []);

  const fetchMembers = useCallback(async () => {
    if (!current) {
      setMembers([]);
      setInvitations([]);
      return;
    }
    try {
      const [membersRes, invitationsRes] = await Promise.all([
        fetch(`/api/workspaces/${current.id}/members`),
        fetch(`/api/workspaces/${current.id}/invitations`),
      ]);
      if (membersRes.ok) {
        setMembers(await membersRes.json());
      }
      if (invitationsRes.ok) {
        setInvitations(await invitationsRes.json());
      }
    } catch {
      // ignore
    }
  }, [current]);

  useEffect(() => {
    Promise.all([fetchWorkspaces()]).finally(() => setLoading(false));
  }, [fetchWorkspaces]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleSwitchWorkspace = async (workspaceId: string | null) => {
    try {
      const res = await fetch("/api/workspaces/current", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(workspaceId ? "Workspace activé" : "Mode personnel activé");
      fetchWorkspaces();
    } catch (err) {
      toast.error("Échec du changement", {
        description: err instanceof Error ? err.message : "Erreur inconnue",
      });
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newWorkspaceName }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `HTTP ${res.status}`);
      }
      toast.success("Workspace créé", {
        description: "Vous êtes maintenant en mode équipe",
      });
      setNewWorkspaceName("");
      setShowCreateModal(false);
      await fetchWorkspaces();
    } catch (err) {
      toast.error("Échec de la création", {
        description: err instanceof Error ? err.message : "Erreur inconnue",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current || !inviteForm.email.trim()) return;
    setInviting(true);
    try {
      const res = await fetch(`/api/workspaces/${current.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inviteForm),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `HTTP ${res.status}`);
      }
      const data = await res.json();
      toast.success("Invitation créée", {
        description: `Lien d'invitation copié dans le presse-papier`,
      });
      // Copy invite URL to clipboard
      if (data.inviteUrl) {
        try {
          await navigator.clipboard.writeText(data.inviteUrl);
        } catch {
          // ignore clipboard errors
        }
      }
      setInviteForm({ email: "", role: "member" });
      setShowInviteModal(false);
      fetchMembers();
    } catch (err) {
      toast.error("Échec de l'invitation", {
        description: err instanceof Error ? err.message : "Erreur inconnue",
      });
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!current) return;
    if (!confirm("Retirer ce membre du workspace ?")) return;
    try {
      const res = await fetch(`/api/workspaces/${current.id}/members/${memberId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Membre retiré");
      fetchMembers();
    } catch (err) {
      toast.error("Échec du retrait", {
        description: err instanceof Error ? err.message : "Erreur inconnue",
      });
    }
  };

  const handleChangeRole = async (memberId: string, role: WorkspaceRole) => {
    if (!current) return;
    try {
      const res = await fetch(`/api/workspaces/${current.id}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Rôle mis à jour");
      fetchMembers();
    } catch (err) {
      toast.error("Échec de la mise à jour", {
        description: err instanceof Error ? err.message : "Erreur inconnue",
      });
    }
  };

  const handleCopyInvite = async (token: string) => {
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/workspaces/invite?token=${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
      toast.success("Lien copié");
    } catch {
      toast.error("Impossible de copier le lien");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-[#00D4FF] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-[#00D4FF]" />
            Équipe & Workspaces
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Collaborez avec votre équipe sur un workspace partagé.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium text-black bg-[#00D4FF] hover:bg-[#00D4FF]/90 transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Nouveau workspace
        </button>
      </div>

      {/* Plan gate notice */}
      {workspaces.length === 0 && (
        <div className="bg-[#0F1520] border border-[#F4A100]/30 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-[#F4A100] flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-[13px] font-medium text-[#F0F4F8]">Plan Business requis</p>
            <p className="text-[12px] text-[#7B8A9A] mt-1">
              Les workspaces équipe sont disponibles à partir du plan Business (3 sièges).
              Le plan Enterprise offre des sièges illimités.
            </p>
          </div>
        </div>
      )}

      {/* Workspace switcher */}
      {workspaces.length > 0 && (
        <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-4">
          <h3 className="text-[11px] font-medium text-[#7B8A9A] uppercase tracking-wider mb-3">
            Workspace actif
          </h3>
          <div className="space-y-2">
            {/* Personal mode */}
            <button
              onClick={() => handleSwitchWorkspace(null)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors ${
                !current
                  ? "bg-[#00D4FF]/10 border-[#00D4FF]/30"
                  : "border-white/[0.06] hover:bg-white/[0.02]"
              }`}
            >
              <div className="w-8 h-8 rounded-md bg-[#18212F] flex items-center justify-center">
                <User className="w-4 h-4 text-[#7B8A9A]" />
              </div>
              <div className="flex-1 text-left">
                <div className="text-[13px] font-medium text-[#F0F4F8]">Mode personnel</div>
                <div className="text-[11px] text-[#7B8A9A]">Vos données privées uniquement</div>
              </div>
              {!current && <Check className="w-4 h-4 text-[#00D4FF]" />}
            </button>

            {/* Workspaces */}
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => handleSwitchWorkspace(ws.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors ${
                  current?.id === ws.id
                    ? "bg-[#00D4FF]/10 border-[#00D4FF]/30"
                    : "border-white/[0.06] hover:bg-white/[0.02]"
                }`}
              >
                <div className="w-8 h-8 rounded-md bg-[#18212F] flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-[#00D4FF]" />
                </div>
                <div className="flex-1 text-left">
                  <div className="text-[13px] font-medium text-[#F0F4F8]">{ws.name}</div>
                  <div className="text-[11px] text-[#7B8A9A]">
                    {ws.memberCount} membre{ws.memberCount !== 1 ? "s" : ""} · {ROLE_CONFIG[ws.role].label}
                  </div>
                </div>
                {current?.id === ws.id && <Check className="w-4 h-4 text-[#00D4FF]" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Members + Invitations (only when a workspace is selected) */}
      {current ? (
        <div className="space-y-4">
          {/* Members */}
          <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#F0F4F8]">Membres ({members.length})</h3>
              {current.role === "admin" && (
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium text-black bg-[#00D4FF] hover:bg-[#00D4FF]/90 transition-colors cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Inviter
                </button>
              )}
            </div>
            <div className="space-y-2">
              {members.map((m) => {
                const roleCfg = ROLE_CONFIG[m.role];
                const RoleIcon = roleCfg.icon;
                const isOwner = m.userId === current.ownerId;
                const canManage = current.role === "admin" && !isOwner;
                return (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-[#18212F] flex items-center justify-center text-[12px] font-medium text-[#F0F4F8]">
                      {(m.name?.[0] || m.email[0] || "?").toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-[#F0F4F8] truncate">
                        {m.name || m.email}
                        {isOwner && (
                          <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-[#F4A100]">
                            <Crown className="w-3 h-3" />
                            Propriétaire
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#7B8A9A] truncate">{m.email}</div>
                    </div>
                    {canManage ? (
                      <select
                        value={m.role}
                        onChange={(e) => handleChangeRole(m.userId, e.target.value as WorkspaceRole)}
                        className={`text-[11px] font-medium px-2 py-1 rounded border ${roleCfg.bg} ${roleCfg.color} cursor-pointer outline-none`}
                      >
                        <option value="admin">Admin</option>
                        <option value="member">Membre</option>
                        <option value="viewer">Lecteur</option>
                      </select>
                    ) : (
                      <span className={`text-[11px] font-medium px-2 py-1 rounded border flex items-center gap-1 ${roleCfg.bg} ${roleCfg.color}`}>
                        <RoleIcon className="w-3 h-3" />
                        {roleCfg.label}
                      </span>
                    )}
                    {canManage && (
                      <button
                        onClick={() => handleRemoveMember(m.userId)}
                        className="text-[#7B8A9A] hover:text-[#E5263A] transition-colors p-1"
                        title="Retirer du workspace"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pending invitations */}
          {current.role === "admin" && invitations.length > 0 && (
            <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-5">
              <h3 className="text-sm font-semibold text-[#F0F4F8] mb-4">
                Invitations en attente ({invitations.length})
              </h3>
              <div className="space-y-2">
                {invitations.map((inv) => {
                  const roleCfg = ROLE_CONFIG[inv.role];
                  const expires = new Date(inv.expiresAt);
                  const isExpired = expires < new Date();
                  return (
                    <div
                      key={inv.id}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-[#18212F] flex items-center justify-center">
                        <UserPlus className="w-4 h-4 text-[#7B8A9A]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium text-[#F0F4F8] truncate">{inv.email}</div>
                        <div className="text-[11px] text-[#7B8A9A]">
                          {isExpired ? "Expirée" : `Expire le ${expires.toLocaleDateString("fr-FR")}`}
                        </div>
                      </div>
                      <span className={`text-[11px] font-medium px-2 py-1 rounded border ${roleCfg.bg} ${roleCfg.color}`}>
                        {roleCfg.label}
                      </span>
                      <button
                        onClick={() => handleCopyInvite(inv.token)}
                        className="text-[#7B8A9A] hover:text-[#00D4FF] transition-colors p-1"
                        title="Copier le lien d'invitation"
                      >
                        {copiedToken === inv.token ? <Check className="w-3.5 h-3.5 text-[#00C48C]" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-8 text-center">
          <Building2 className="w-8 h-8 text-[#7B8A9A]/40 mx-auto mb-3" />
          <p className="text-[13px] text-[#7B8A9A]">
            {workspaces.length === 0
              ? "Aucun workspace. Créez-en un pour collaborer avec votre équipe."
              : "Sélectionnez un workspace ci-dessus pour voir ses membres."}
          </p>
        </div>
      )}

      {/* Create workspace modal */}
      {showCreateModal && (
        <Modal onClose={() => setShowCreateModal(false)} title="Nouveau workspace">
          <form onSubmit={handleCreateWorkspace} className="space-y-4">
            <div>
              <label className="block text-[12px] text-[#7B8A9A] mb-1.5">Nom du workspace</label>
              <input
                type="text"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                placeholder="Acme Growth Team"
                autoFocus
                className="w-full px-3 py-2 rounded-md bg-[#0A0E14] border border-white/[0.06] text-[13px] text-[#F0F4F8] placeholder-[#7B8A9A]/60 outline-none focus:border-[#00D4FF]/40"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-3 py-1.5 rounded-md text-[12px] font-medium text-[#7B8A9A] hover:text-[#F0F4F8] transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={creating || !newWorkspaceName.trim()}
                className="px-3 py-1.5 rounded-md text-[12px] font-medium text-black bg-[#00D4FF] hover:bg-[#00D4FF]/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {creating && <Loader2 className="w-3 h-3 animate-spin" />}
                Créer
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Invite member modal */}
      {showInviteModal && current && (
        <Modal onClose={() => setShowInviteModal(false)} title="Inviter un membre">
          <form onSubmit={handleInvite} className="space-y-4">
            <div>
              <label className="block text-[12px] text-[#7B8A9A] mb-1.5">Email</label>
              <input
                type="email"
                value={inviteForm.email}
                onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="colleague@company.com"
                autoFocus
                required
                className="w-full px-3 py-2 rounded-md bg-[#0A0E14] border border-white/[0.06] text-[13px] text-[#F0F4F8] placeholder-[#7B8A9A]/60 outline-none focus:border-[#00D4FF]/40"
              />
            </div>
            <div>
              <label className="block text-[12px] text-[#7B8A9A] mb-1.5">Rôle</label>
              <div className="grid grid-cols-3 gap-2">
                {(["admin", "member", "viewer"] as WorkspaceRole[]).map((r) => {
                  const cfg = ROLE_CONFIG[r];
                  const Icon = cfg.icon;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setInviteForm((f) => ({ ...f, role: r }))}
                      className={`flex flex-col items-center gap-1.5 px-2 py-2.5 rounded-md border transition-colors ${
                        inviteForm.role === r
                          ? `${cfg.bg} ${cfg.color} border-current`
                          : "border-white/[0.06] text-[#7B8A9A] hover:bg-white/[0.02]"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-[11px] font-medium">{cfg.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="px-3 py-1.5 rounded-md text-[12px] font-medium text-[#7B8A9A] hover:text-[#F0F4F8] transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={inviting || !inviteForm.email.trim()}
                className="px-3 py-1.5 rounded-md text-[12px] font-medium text-black bg-[#00D4FF] hover:bg-[#00D4FF]/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {inviting && <Loader2 className="w-3 h-3 animate-spin" />}
                Créer l'invitation
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[#0F1520] border border-white/[0.06] rounded-xl p-5 max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[#F0F4F8]">{title}</h3>
          <button onClick={onClose} className="text-[#7B8A9A] hover:text-[#F0F4F8] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
