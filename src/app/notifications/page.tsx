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

type Unit = {
  id: string;
  name: string;
};

type UserUnitRow = {
  user_id: string;
};

export default function NotificationsPage() {
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [channel, setChannel] = useState("app");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    void loadNotifications();
    void loadUnits();

    const channelSub = supabase
      .channel("notification-logs-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notification_logs" },
        () => void loadNotifications()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channelSub);
    };
  }, []);

  async function loadUnits() {
    const { data } = await supabase
      .from("units")
      .select("id, name")
      .order("name");

    setUnits((data as Unit[]) ?? []);
  }

  async function loadNotifications() {
    setLoading(true);

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
      .order("created_at", { ascending: false })
      .limit(100);

    setLogs((data as NotificationLog[]) ?? []);
    setLoading(false);
  }

  function toggleUnit(unitId: string) {
    setSelectedUnits((prev) =>
      prev.includes(unitId)
        ? prev.filter((id) => id !== unitId)
        : [...prev, unitId]
    );
  }

  async function sendNotification() {
    if (selectedUnits.length === 0 || !title.trim()) {
      alert("Select at least one team and enter a title.");
      return;
    }

    setSending(true);

    const { data: userUnitRows, error: userUnitError } = await supabase
      .from("user_units")
      .select("user_id")
      .in("unit_id", selectedUnits);

    if (userUnitError) {
      setSending(false);
      alert(userUnitError.message);
      return;
    }

    const uniqueUserIds = Array.from(
      new Set(((userUnitRows as UserUnitRow[]) ?? []).map((row) => row.user_id))
    );

    if (uniqueUserIds.length === 0) {
      setSending(false);
      alert("No users found in selected team(s).");
      return;
    }

    const { error } = await supabase.from("notification_logs").insert(
      uniqueUserIds.map((userId) => ({
        user_id: userId,
        channel,
        notification_type: "manual_team",
        title: title.trim(),
        body: body.trim() || null,
        status: "pending",
      }))
    );

    setSending(false);

    if (error) {
      alert(error.message);
      return;
    }

    setTitle("");
    setBody("");
    setSelectedUnits([]);
    alert(`Notification sent to ${uniqueUserIds.length} user(s).`);
    await loadNotifications();
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

        <div className="space-y-3 rounded-xl bg-gray-900 p-5">
          <div className="text-lg font-semibold">Send Team Notification</div>

          <div className="rounded-lg bg-black/30 p-4">
            <div className="mb-3 text-sm font-medium text-gray-300">
              Select Team(s)
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {units.map((unit) => (
                <label
                  key={unit.id}
                  className={`flex items-center gap-2 rounded px-3 py-2 text-sm ${
                    selectedUnits.includes(unit.id)
                      ? "bg-red-600"
                      : "bg-gray-800"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedUnits.includes(unit.id)}
                    onChange={() => toggleUnit(unit.id)}
                  />
                  <span>{unit.name}</span>
                </label>
              ))}
            </div>
          </div>

          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            className="w-full rounded bg-black px-3 py-2"
          >
            <option value="app">App</option>
            <option value="email">Email</option>
            <option value="sms">SMS</option>
          </select>

          <input
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded bg-black px-3 py-2"
          />

          <textarea
            placeholder="Message"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full rounded bg-black px-3 py-2"
            rows={4}
          />

          <button
            onClick={() => void sendNotification()}
            disabled={sending}
            className="w-full rounded bg-red-600 py-2 disabled:opacity-60"
          >
            {sending ? "Sending..." : "Send to Selected Teams"}
          </button>
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