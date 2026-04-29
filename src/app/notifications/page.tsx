"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import RoleSwitcher from "@/components/RoleSwitcher";

type NotificationLog = {
  id: string;
  channel: string;
  notification_type: string;
  title: string;
  body: string | null;
  status: string | null;
  created_at: string;
  sent_at: string | null;
  related_incident_id: string | null;
};

export default function NotificationsPage() {
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadNotifications();

    const channel = supabase
      .channel("notification-logs-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notification_logs" },
        () => void loadNotifications()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  async function loadNotifications() {
    setLoading(true);

    const { data: authData } = await supabase.auth.getUser();
    const email = authData.user?.email;

    if (!email) {
      setLoading(false);
      return;
    }

    const { data: user } = await supabase
      .from("users")
      .select("id")
      .ilike("email", email)
      .maybeSingle();

    if (!user?.id) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("notification_logs")
      .select(`
        id,
        channel,
        notification_type,
        title,
        body,
        status,
        created_at,
        sent_at,
        related_incident_id
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    setLogs((data as NotificationLog[]) ?? []);
    setLoading(false);
  }

  function formatDateTime(date: string) {
    return new Date(date).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <main className="min-h-screen bg-black px-4 py-5 pb-28 text-white sm:p-6 sm:pb-28">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            href="/"
            className="rounded border border-gray-800 bg-gray-900 px-4 py-2 text-sm"
          >
            Dashboard
          </Link>

          <RoleSwitcher />
        </div>

        <div>
          <p className="text-sm text-gray-500">Matzil SAR</p>
          <h1 className="text-3xl font-bold">Notifications</h1>
        </div>

        {loading ? (
          <div className="rounded-xl bg-gray-900 p-5 text-gray-400">
            Loading notifications...
          </div>
        ) : logs.length === 0 ? (
          <div className="rounded-xl bg-gray-900 p-5 text-gray-400">
            No notifications yet.
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div key={log.id} className="rounded-xl bg-gray-900 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">{log.title}</div>
                    <div className="mt-1 text-xs text-gray-500">
                      {log.channel.toUpperCase()} • {log.notification_type}
                    </div>
                  </div>

                  <div className="text-xs text-gray-500">
                    {formatDateTime(log.created_at)}
                  </div>
                </div>

                {log.body && (
                  <div className="mt-3 whitespace-pre-wrap text-sm text-gray-300">
                    {log.body}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="rounded bg-black/40 px-2 py-1 text-xs text-gray-400">
                    {log.status || "pending"}
                  </span>

                  {log.related_incident_id && (
                    <Link
                      href={`/incidents/${log.related_incident_id}`}
                      className="rounded bg-red-600 px-3 py-1 text-xs"
                    >
                      Open Incident
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}