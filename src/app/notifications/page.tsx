"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentTestEmail, getStoredRole } from "@/lib/dev-user";

type Notification = {
  id: string;
  title: string;
  body: string | null;
  location: string | null;
  priority: string | null;
  created_at: string;
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const email = getCurrentTestEmail();
      const { data: user } = await supabase
        .from("users")
        .select("id")
        .eq("email", email)
        .single();

      if (!user) { setLoading(false); return; }
      setUserId(user.id);
      await loadNotifications(user.id);

      const channel = supabase
        .channel("my-notifications")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notification_logs", filter: `user_id=eq.${user.id}` },
          (payload) => {
            setNotifications((prev) => [payload.new as Notification, ...prev]);
          }
        )
        .subscribe();

      return () => { void supabase.removeChannel(channel); };
    }

    void init();
  }, []);

  async function loadNotifications(uid: string) {
    setLoading(true);
    const { data } = await supabase
      .from("notification_logs")
      .select("id,title,body,location,priority,created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(100);

    setNotifications((data as Notification[]) ?? []);
    setLoading(false);
  }

  function fmt(d: string) {
    return new Date(d).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <main className="p-4 lg:p-8">
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-2xl font-bold text-zinc-50">Notifications</h1>

        {loading ? (
          <div className="text-sm text-zinc-500 py-8 text-center">Loading…</div>
        ) : notifications.length === 0 ? (
          <div className="rounded-xl bg-zinc-900 p-8 text-center text-sm text-zinc-500">
            No notifications yet.
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`rounded-xl p-4 border ${
                  n.priority === "critical"
                    ? "bg-red-950/30 border-red-800/50"
                    : "bg-zinc-900 border-zinc-800"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {n.priority === "critical" && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-600/20 text-red-400 shrink-0">
                          ⚠ Critical
                        </span>
                      )}
                      <span className="font-semibold text-zinc-100">{n.title}</span>
                    </div>
                    {n.body && (
                      <p className="text-sm text-zinc-300 whitespace-pre-wrap">{n.body}</p>
                    )}
                    {n.location && (
                      <p className="text-xs text-zinc-400 flex items-center gap-1">
                        <span>📍</span>
                        <span>{n.location}</span>
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-zinc-500 shrink-0">{fmt(n.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
