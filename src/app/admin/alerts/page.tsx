"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import { logAudit } from "@/lib/audit";
import { getCurrentTestEmail } from "@/lib/dev-user";

type Member = { id: string; full_name: string | null; call_sign: string | null };

type SentNotification = {
  id: string;
  title: string;
  body: string | null;
  location: string | null;
  priority: string;
  created_at: string;
  recipient_count: number;
};

export default function AdminAlertsPage() {
  const toast = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [senderId, setSenderId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [location, setLocation] = useState("");
  const [priority, setPriority] = useState<"routine" | "critical">("routine");
  const [target, setTarget] = useState<"all" | "duty" | "specific">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [memberSearch, setMemberSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [sentHistory, setSentHistory] = useState<SentNotification[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    void supabase
      .from("users")
      .select("id,full_name,call_sign")
      .order("call_sign")
      .then(({ data }) => setMembers((data ?? []) as Member[]));

    const email = getCurrentTestEmail();
    void supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .single()
      .then(({ data }) => { if (data) setSenderId(data.id); });

    void loadHistory();
  }, []);

  async function loadHistory() {
    setHistoryLoading(true);
    // Show distinct sends by grouping on sender_id + title + created_at minute
    // We fetch recent logs where this sender sent, grouped by broadcast
    const { data } = await supabase
      .from("notification_logs")
      .select("id,title,body,location,priority,created_at,sender_id")
      .not("sender_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(200);

    if (!data) { setHistoryLoading(false); return; }

    // Collapse rows into broadcasts: same sender + title within 5s = same send
    const seen = new Map<string, SentNotification>();
    for (const row of data as any[]) {
      const bucket = `${row.sender_id}|${row.title}|${row.created_at?.slice(0, 16)}`;
      if (seen.has(bucket)) {
        seen.get(bucket)!.recipient_count++;
      } else {
        seen.set(bucket, {
          id: row.id,
          title: row.title,
          body: row.body,
          location: row.location,
          priority: row.priority ?? "routine",
          created_at: row.created_at,
          recipient_count: 1,
        });
      }
    }
    setSentHistory(Array.from(seen.values()));
    setHistoryLoading(false);
  }

  const filteredMembers = memberSearch.trim()
    ? members.filter((m) =>
        [m.full_name, m.call_sign].join(" ").toLowerCase().includes(memberSearch.toLowerCase())
      )
    : members;

  function toggleMember(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function send() {
    if (!title.trim()) { toast("Title is required.", "error"); return; }

    let targetIds: string[] = [];

    if (target === "all") {
      targetIds = members.map((m) => m.id);
    } else if (target === "duty") {
      const { data } = await supabase.from("users").select("id").eq("is_on_duty", true);
      targetIds = (data ?? []).map((r: any) => r.id);
    } else {
      targetIds = [...selectedIds];
    }

    if (targetIds.length === 0) { toast("No recipients selected.", "error"); return; }

    setSending(true);

    // Write to notification_logs for each recipient
    const logRows = targetIds.map((uid) => ({
      user_id: uid,
      sender_id: senderId,
      channel: "app",
      notification_type: "broadcast",
      title: title.trim(),
      body: body.trim() || null,
      location: location.trim() || null,
      priority,
      status: "sent",
    }));

    await supabase.from("notification_logs").insert(logRows);

    // Push via FCM/VAPID
    let ok = 0;
    await Promise.all(
      targetIds.map(async (user_id) => {
        const res = await fetch("/api/send-push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id,
            title: title.trim(),
            body: body.trim() || undefined,
            url: "/notifications",
            critical: priority === "critical",
          }),
        });
        if (res.ok) ok++;
      })
    );

    setSending(false);
    toast(`Alert sent to ${ok} member${ok !== 1 ? "s" : ""}.`, "success");

    void logAudit({
      action: "send_alert",
      entity_type: "alert",
      entity_label: title.trim(),
      details: { target, recipient_count: targetIds.length, priority },
    });

    setTitle("");
    setBody("");
    setLocation("");
    setPriority("routine");
    setSelectedIds(new Set());
    void loadHistory();
  }

  function fmt(d: string) {
    return new Date(d).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <main className="p-6 lg:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold text-zinc-50">Send Notification</h1>

        {/* Compose */}
        <div className="rounded-xl bg-zinc-900 p-5 space-y-4">

          {/* Priority toggle */}
          <div className="flex gap-2">
            {(["routine", "critical"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPriority(p)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  priority === p
                    ? p === "critical"
                      ? "bg-red-600 text-white"
                      : "bg-[#E94E1B] text-white"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                }`}
              >
                {p === "routine" ? "Routine" : "⚠ Critical"}
              </button>
            ))}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-400">Title *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Notification title…"
              className="w-full rounded-lg bg-black px-3 py-2.5 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-[#E94E1B] placeholder-zinc-600"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-400">Description (optional)</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Additional details…"
              rows={3}
              className="w-full rounded-lg bg-black px-3 py-2.5 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-[#E94E1B] placeholder-zinc-600 resize-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-400">Location (optional)</label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Staging area, 42 Main St…"
              className="w-full rounded-lg bg-black px-3 py-2.5 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-[#E94E1B] placeholder-zinc-600"
            />
          </div>
        </div>

        {/* Recipients */}
        <div className="rounded-xl bg-zinc-900 p-5 space-y-4">
          <div className="font-semibold text-zinc-100">Recipients</div>

          <div className="flex flex-wrap gap-2">
            {(["all", "duty", "specific"] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setTarget(opt)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  target === opt
                    ? "bg-[#E94E1B] text-white"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                }`}
              >
                {opt === "all" ? "All members" : opt === "duty" ? "On-duty only" : "Specific members"}
              </button>
            ))}
          </div>

          {target === "specific" && (
            <div className="space-y-3">
              <input
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search members…"
                className="w-full rounded-lg bg-black px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-[#E94E1B] placeholder-zinc-600"
              />
              <div className="max-h-60 overflow-y-auto rounded-lg border border-zinc-800 divide-y divide-zinc-800">
                {filteredMembers.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => toggleMember(m.id)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-zinc-800 transition"
                  >
                    <span className={`h-4 w-4 rounded border-2 shrink-0 transition ${
                      selectedIds.has(m.id) ? "bg-[#E94E1B] border-[#E94E1B]" : "border-zinc-600"
                    }`} />
                    <span className="font-mono text-sm text-zinc-100">{m.call_sign ?? "—"}</span>
                    <span className="text-sm text-zinc-400">{m.full_name}</span>
                  </button>
                ))}
              </div>
              {selectedIds.size > 0 && (
                <div className="text-xs text-zinc-500">{selectedIds.size} member{selectedIds.size !== 1 ? "s" : ""} selected</div>
              )}
            </div>
          )}
        </div>

        <button
          onClick={() => void send()}
          disabled={sending || !title.trim()}
          className="w-full rounded-xl bg-[#E94E1B] px-6 py-3 font-semibold text-white hover:bg-orange-600 disabled:opacity-50 transition"
        >
          {sending ? "Sending…" : "Send Notification"}
        </button>

        {/* Sent history */}
        <div>
          <h2 className="text-lg font-semibold text-zinc-100 mb-3">Sent History</h2>
          {historyLoading ? (
            <div className="text-sm text-zinc-500">Loading…</div>
          ) : sentHistory.length === 0 ? (
            <div className="rounded-xl bg-zinc-900 p-5 text-sm text-zinc-500">No notifications sent yet.</div>
          ) : (
            <div className="space-y-3">
              {sentHistory.map((n) => (
                <div key={n.id} className="rounded-xl bg-zinc-900 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          n.priority === "critical" ? "bg-red-600/20 text-red-400" : "bg-zinc-700 text-zinc-400"
                        }`}>
                          {n.priority === "critical" ? "⚠ Critical" : "Routine"}
                        </span>
                        <span className="font-semibold text-zinc-100">{n.title}</span>
                      </div>
                      {n.body && <p className="text-sm text-zinc-400">{n.body}</p>}
                      {n.location && (
                        <p className="text-xs text-zinc-500">📍 {n.location}</p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-xs text-zinc-500">{fmt(n.created_at)}</div>
                      <div className="text-xs text-zinc-600">{n.recipient_count} recipient{n.recipient_count !== 1 ? "s" : ""}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
