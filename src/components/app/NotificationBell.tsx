"use client";

/**
 * HERMÈS — Notification Bell
 *
 * Bell icon in the sidebar header with an unread count badge. Clicking it
 * opens a dropdown preview of the 5 most recent unread notifications,
 * with a "Voir tout" link to the full Notifications view.
 *
 * Polls /api/data/notifications?unreadOnly=true every 60s to refresh the
 * badge count without the user opening the panel.
 */
import { useEffect, useState, useRef } from "react";
import { Bell, CheckCircle2, AlertTriangle, Info, AlertCircle } from "lucide-react";
import { useAppStore } from "@/store/appStore";

interface NotifPreview {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error" | "system";
  priority: "low" | "medium" | "high" | "critical";
  createdAt: string;
  read: boolean;
}

const POLL_INTERVAL_MS = 60_000;

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "à l'instant";
  if (diff < 3_600_000) return `il y a ${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `il y a ${Math.floor(diff / 3_600_000)} h`;
  return `il y a ${Math.floor(diff / 86_400_000)} j`;
}

function typeIcon(type: NotifPreview["type"]) {
  switch (type) {
    case "success": return <CheckCircle2 className="w-3.5 h-3.5 text-[#00C48C]" />;
    case "warning": return <AlertTriangle className="w-3.5 h-3.5 text-[#F4A100]" />;
    case "error": return <AlertCircle className="w-3.5 h-3.5 text-[#E5263A]" />;
    default: return <Info className="w-3.5 h-3.5 text-[#00D4FF]" />;
  }
}

export function NotificationBell() {
  const [unread, setUnread] = useState<NotifPreview[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const setCurrentView = useAppStore((s) => s.setCurrentView);

  // Fetch unread notifications count + 5 most recent for the preview
  const refresh = async () => {
    try {
      const res = await fetch("/api/data/notifications?unreadOnly=true&limit=5");
      if (!res.ok) return;
      const data = await res.json();
      const notifs: NotifPreview[] = (data.notifications ?? []).map((n: Record<string, unknown>) => ({
        id: String(n.id ?? ""),
        title: String(n.title ?? ""),
        message: String(n.message ?? ""),
        type: (n.type as NotifPreview["type"]) ?? "info",
        priority: (n.priority as NotifPreview["priority"]) ?? "medium",
        createdAt: n.createdAt instanceof Date ? (n.createdAt as Date).toISOString() : String(n.createdAt ?? new Date().toISOString()),
        read: Boolean(n.read ?? false),
      }));
      setUnread(notifs);
    } catch {
      /* silent — the bell just shows 0 unread on error */
    }
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        open &&
        dropdownRef.current &&
        buttonRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const count = unread.length;

  const handleMarkAllRead = async () => {
    setLoading(true);
    try {
      // Mark each unread notification as read
      await Promise.all(
        unread.slice(0, 5).map((n) =>
          fetch(`/api/data/notifications?id=${n.id}&action=mark-read`, { method: "PUT" }).catch(() => null),
        ),
      );
      setUnread([]);
    } finally {
      setLoading(false);
    }
  };

  const handleViewAll = () => {
    setOpen(false);
    setCurrentView("notifications");
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        className="relative w-8 h-8 flex items-center justify-center rounded-md text-[#7B8A9A] hover:text-[#F0F4F8] hover:bg-white/[0.04] transition-colors cursor-pointer"
        title="Notifications"
        aria-label={`Notifications${count > 0 ? ` (${count} non lues)` : ""}`}
      >
        <Bell className="w-4 h-4" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#E5263A] text-white text-[9px] font-bold flex items-center justify-center">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={dropdownRef}
          className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-[#0F1520] border border-white/[0.08] rounded-xl shadow-2xl z-50 overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <h3 className="text-[13px] font-semibold text-[#F0F4F8]">
              Notifications
              {count > 0 && (
                <span className="ml-2 text-[11px] text-[#7B8A9A] font-normal">
                  {count} non lue{count !== 1 ? "s" : ""}
                </span>
              )}
            </h3>
            {count > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={loading}
                className="text-[11px] text-[#00D4FF] hover:text-[#00D4FF]/80 disabled:opacity-50 cursor-pointer"
              >
                Tout marquer lu
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {count === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="w-6 h-6 text-[#7B8A9A]/30 mx-auto mb-2" />
                <p className="text-[12px] text-[#7B8A9A]">Aucune notification non lue</p>
              </div>
            ) : (
              unread.map((n) => (
                <div
                  key={n.id}
                  className="px-4 py-3 border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 flex-shrink-0">{typeIcon(n.type)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-[#F0F4F8] truncate">{n.title}</p>
                      <p className="text-[11px] text-[#7B8A9A] mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-[#7B8A9A]/60 mt-1">{relativeTime(n.createdAt)}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <button
            onClick={handleViewAll}
            className="w-full px-4 py-2.5 text-[12px] font-medium text-[#00D4FF] hover:bg-[#00D4FF]/5 transition-colors border-t border-white/[0.06] cursor-pointer"
          >
            Voir toutes les notifications
          </button>
        </div>
      )}
    </div>
  );
}
