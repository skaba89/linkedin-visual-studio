"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Notification,
  NotificationCategory,
  NotificationPriority,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  CHANNEL_LABELS,
  DEFAULT_NOTIFICATION_PREFERENCES,
  NotificationPreference,
} from "@/lib/notifications/types";
import { notificationEngine } from "@/lib/notifications";
import {
  Bell,
  BellOff,
  Check,
  X,
  Filter,
  Settings,
  Bot,
  Users,
  Building2,
  Mail,
  Linkedin,
  Shield,
  GitBranch,
  Settings2,
  Volume2,
  VolumeX,
  Clock,
} from "lucide-react";

type TabType = "all" | "preferences";

export default function NotificationsView() {
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState({ total: 0, unread: 0, byCategory: {} as Record<string, number>, byPriority: {} as Record<string, number>, todayCount: 0 });
  const [preferences, setPreferences] = useState<NotificationPreference[]>([...DEFAULT_NOTIFICATION_PREFERENCES]);
  const [filterCategory, setFilterCategory] = useState<NotificationCategory | "all">("all");
  const [filterUnread, setFilterUnread] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterCategory !== "all") params.set("category", filterCategory);
      if (filterUnread) params.set("unreadOnly", "true");
      const res = await fetch(`/api/data/notifications?${params}`);
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setStats(data.stats ?? { total: 0, unread: 0, byCategory: {}, byPriority: {}, todayCount: 0 });
    } catch {
      const notifs = notificationEngine.getNotifications({
        category: filterCategory !== "all" ? filterCategory : undefined,
        unreadOnly: filterUnread || undefined,
      });
      setNotifications(notifs);
      setStats(notificationEngine.getStats());
    }
  }, [filterCategory, filterUnread]);

  const fetchPreferences = useCallback(async () => {
    try {
      const res = await fetch("/api/data/notifications?preferences=true");
      const data = await res.json();
      setPreferences(data.preferences ?? DEFAULT_NOTIFICATION_PREFERENCES);
    } catch {
      setPreferences(notificationEngine.getPreferences());
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchPreferences();
  }, [fetchData, fetchPreferences]);

  const markAsRead = async (id: string) => {
    try {
      await fetch("/api/data/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "markRead", id }),
      });
    } catch { /* fallback */ }
    notificationEngine.markAsRead(id);
    fetchData();
  };

  const markAllRead = async () => {
    try {
      await fetch("/api/data/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "markAllRead" }),
      });
    } catch { /* fallback */ }
    notificationEngine.markAllAsRead();
    fetchData();
  };

  const dismiss = async (id: string) => {
    try {
      await fetch("/api/data/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss", id }),
      });
    } catch { /* fallback */ }
    notificationEngine.dismiss(id);
    fetchData();
  };

  const dismissAll = async () => {
    try {
      await fetch("/api/data/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismissAll" }),
      });
    } catch { /* fallback */ }
    notificationEngine.dismissAll();
    fetchData();
  };

  const updatePreference = async (category: NotificationCategory, updates: Partial<NotificationPreference>) => {
    try {
      await fetch("/api/data/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updatePreference", category, updates }),
      });
    } catch { /* fallback */ }
    notificationEngine.updatePreference(category, updates);
    fetchPreferences();
  };

  const getCategoryIcon = (cat: NotificationCategory) => {
    const icons: Record<string, React.ElementType> = {
      agent: Bot, lead: Users, deal: Building2, email: Mail,
      linkedin: Linkedin, compliance: Shield, workflow: GitBranch, system: Settings2,
    };
    return icons[cat] ?? Bell;
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "À l'instant";
    if (minutes < 60) return `Il y a ${minutes}min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Il y a ${hours}h`;
    const days = Math.floor(hours / 24);
    return `Il y a ${days}j`;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Notifications</h1>
          <p className="text-sm text-[#7B8A9A] mt-1">Centre de notifications et préférences d&apos;alertes</p>
        </div>
        <div className="flex items-center gap-2">
          {stats.unread > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#00D4FF]/10 text-[#00D4FF] hover:bg-[#00D4FF]/20 transition-colors cursor-pointer"
            >
              <Check className="w-3 h-3" /> Tout marquer lu
            </button>
          )}
          <button
            onClick={dismissAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.04] text-[#7B8A9A] hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-3 h-3" /> Tout effacer
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-[#0F1520] rounded-xl border border-white/[0.06] p-4">
          <div className="text-2xl font-bold text-white">{stats.total}</div>
          <div className="text-xs text-[#7B8A9A] mt-0.5">Total</div>
        </div>
        <div className="bg-[#0F1520] rounded-xl border border-white/[0.06] p-4">
          <div className="text-2xl font-bold text-[#00D4FF]">{stats.unread}</div>
          <div className="text-xs text-[#7B8A9A] mt-0.5">Non lues</div>
        </div>
        <div className="bg-[#0F1520] rounded-xl border border-white/[0.06] p-4">
          <div className="text-2xl font-bold text-[#00C48C]">{stats.todayCount}</div>
          <div className="text-xs text-[#7B8A9A] mt-0.5">Aujourd&apos;hui</div>
        </div>
        <div className="bg-[#0F1520] rounded-xl border border-white/[0.06] p-4">
          <div className="text-2xl font-bold text-[#F4A100]">{stats.byPriority?.critical ?? 0}</div>
          <div className="text-xs text-[#7B8A9A] mt-0.5">Critiques</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[#0A0E14] rounded-lg p-1 border border-white/[0.06]">
        <button
          onClick={() => setActiveTab("all")}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
            activeTab === "all" ? "bg-[#00D4FF]/10 text-[#00D4FF]" : "text-[#7B8A9A] hover:text-white"
          }`}
        >
          Notifications
        </button>
        <button
          onClick={() => setActiveTab("preferences")}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
            activeTab === "preferences" ? "bg-[#00D4FF]/10 text-[#00D4FF]" : "text-[#7B8A9A] hover:text-white"
          }`}
        >
          Préférences
        </button>
      </div>

      {/* Notifications List */}
      {activeTab === "all" && (
        <div>
          {/* Filters */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <button
              onClick={() => setFilterCategory("all")}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                filterCategory === "all" ? "bg-[#00D4FF]/10 text-[#00D4FF]" : "bg-white/[0.04] text-[#7B8A9A]"
              }`}
            >
              Toutes
            </button>
            {(Object.keys(CATEGORY_LABELS) as NotificationCategory[]).map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  filterCategory === cat ? "text-white" : "bg-white/[0.04] text-[#7B8A9A]"
                }`}
                style={filterCategory === cat ? { backgroundColor: `${CATEGORY_COLORS[cat]}20`, color: CATEGORY_COLORS[cat] } : {}}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
            <div className="border-l border-white/[0.06] h-5 mx-1" />
            <button
              onClick={() => setFilterUnread(!filterUnread)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                filterUnread ? "bg-[#00D4FF]/10 text-[#00D4FF]" : "bg-white/[0.04] text-[#7B8A9A]"
              }`}
            >
              Non lues uniquement
            </button>
          </div>

          {/* Notification items */}
          <div className="space-y-2">
            {notifications.length === 0 && (
              <div className="text-center py-16 text-[#7B8A9A]">
                <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Aucune notification</p>
                <p className="text-xs mt-1">Les alertes de vos agents apparaîtront ici</p>
              </div>
            )}
            {notifications.map((notif) => {
              const Icon = getCategoryIcon(notif.category);
              return (
                <div
                  key={notif.id}
                  className={`flex items-start gap-3 p-4 rounded-xl border transition-colors cursor-pointer group ${
                    notif.read
                      ? "bg-[#0F1520] border-white/[0.04] opacity-70"
                      : "bg-[#0F1520] border-white/[0.08] hover:border-white/[0.12]"
                  }`}
                  onClick={() => markAsRead(notif.id)}
                >
                  {/* Category icon */}
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${CATEGORY_COLORS[notif.category]}15` }}
                  >
                    <Icon className="w-4 h-4" style={{ color: CATEGORY_COLORS[notif.category] }} />
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-sm font-semibold ${notif.read ? "text-[#7B8A9A]" : "text-white"}`}>{notif.title}</span>
                      {!notif.read && <div className="w-1.5 h-1.5 rounded-full bg-[#00D4FF]" />}
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                        style={{ backgroundColor: `${PRIORITY_COLORS[notif.priority]}15`, color: PRIORITY_COLORS[notif.priority] }}
                      >
                        {PRIORITY_LABELS[notif.priority]}
                      </span>
                    </div>
                    <p className={`text-xs ${notif.read ? "text-[#4B5563]" : "text-[#7B8A9A]"} leading-relaxed`}>{notif.message}</p>
                    <div className="flex items-center gap-2 mt-1.5 text-[10px] text-[#4B5563]">
                      <span>{timeAgo(notif.createdAt)}</span>
                      {notif.sourceAgent && <span>· Agent: {notif.sourceAgent}</span>}
                    </div>
                  </div>
                  {/* Actions */}
                  <button
                    onClick={(e) => { e.stopPropagation(); dismiss(notif.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/[0.06] text-[#4B5563] hover:text-[#E5263A] transition-all cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Preferences */}
      {activeTab === "preferences" && (
        <div className="space-y-3">
          {preferences.map((pref) => {
            const Icon = getCategoryIcon(pref.category);
            return (
              <div key={pref.category} className="bg-[#0F1520] rounded-xl border border-white/[0.06] p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${CATEGORY_COLORS[pref.category]}15` }}
                    >
                      <Icon className="w-4 h-4" style={{ color: CATEGORY_COLORS[pref.category] }} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">{CATEGORY_LABELS[pref.category]}</div>
                      <div className="text-xs text-[#7B8A9A]">Priorité min: {PRIORITY_LABELS[pref.minPriority]}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => updatePreference(pref.category, { enabled: !pref.enabled })}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                      pref.enabled ? "bg-[#00C48C]/10 text-[#00C48C]" : "bg-white/[0.04] text-[#4B5563]"
                    }`}
                  >
                    {pref.enabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </button>
                </div>
                {/* Channels */}
                <div className="flex items-center gap-2 flex-wrap">
                  {(["in_app", "email", "slack", "discord"] as const).map((channel) => {
                    const isActive = pref.channels.includes(channel);
                    return (
                      <button
                        key={channel}
                        onClick={() => {
                          const channels = isActive
                            ? pref.channels.filter((c) => c !== channel)
                            : [...pref.channels, channel];
                          updatePreference(pref.category, { channels });
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors cursor-pointer ${
                          isActive
                            ? "bg-[#00D4FF]/10 text-[#00D4FF]"
                            : "bg-white/[0.04] text-[#4B5563]"
                        }`}
                      >
                        {CHANNEL_LABELS[channel]}
                      </button>
                    );
                  })}
                </div>
                {/* Quiet hours toggle */}
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/[0.04]">
                  <Clock className="w-3.5 h-3.5 text-[#7B8A9A]" />
                  <span className="text-xs text-[#7B8A9A]">Heures calmes</span>
                  <button
                    onClick={() => updatePreference(pref.category, { quietHoursEnabled: !pref.quietHoursEnabled })}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                      pref.quietHoursEnabled ? "bg-[#8B5CF6]/10 text-[#8B5CF6]" : "bg-white/[0.04] text-[#4B5563]"
                    }`}
                  >
                    {pref.quietHoursEnabled ? `${pref.quietHoursStart} - ${pref.quietHoursEnd}` : "Désactivé"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
