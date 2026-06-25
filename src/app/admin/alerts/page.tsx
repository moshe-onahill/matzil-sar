"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import { logAudit } from "@/lib/audit";
import { getCurrentTestEmail } from "@/lib/dev-user";

type Member = { id: string; full_name: string | null; call_sign: string | null };

type SentNotification = {
  broadcast_id: string;
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
  const [group, setGroup] = useState<string>("ALL");
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
    const { data } = await supabase
      .from("notification_logs")
      .select("id,broadcast_id,title,body,location,priority,created_at,sender_id")
      .not("sender_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(500);

    if (!data) { setHistoryLoading(false); return; }

    // Collapse by broadcast_id (preferred) or fallback to sender+title+minute bucket
    const seen = new Map<string, SentNotification>();
    for (const row of data as any[]) {
      const key = row.broadcast_id ?? `${row.sender_id}|${row.title}|${row.created_at?.slice(0, 16)}`;
      if (seen.has(key)) {
        seen.get(key)!.recipient_count++;
      } else {
        seen.set(key, {
          broadcast_id: row.broadcast_id ?? key,
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

  async function getTargetIds(): Promise<string[]> {
    if (group === "ALL") return members.map((m) => m.id);
    if (group === "CUSTOM") return [...selectedIds];
    const { data } = await supabase
      .from("user_units")
      .select("user_id, units!inner(name)")
      .ilike("units.name", group);
    return (data ?? []).map((r: any) => r.user_id);
  }

  async function send() {
    if (!title.trim()) { toast("Title is required.", "error"); return; }
    if (group === "CUSTOM" && selectedIds.size === 0) { toast("Select at least one member.", "error"); return; }

    const targetIds = await getTargetIds();
    if (targetIds.length === 0) { toast("No recipients found.", "error"); return; }

    setSending(true);

    const broadcast_id = crypto.randomUUID();
    const logRows = targetIds.map((uid) => ({
      user_id: uid,
      sender_id: senderId,
      broadcast_id,
      channel: "app",
      notification_type: "broadcast",
      title: title.trim(),
      body: body.trim() || null,
      location: location.trim() || null,
      priority,
      status: "sent",
    }));

    await supabase.from("notification_logs").insert(logRows);

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
      details: { group, recipient_count: targetIds.length, priority },
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

  async function deleteHistory(n: SentNotification) {
    const body = (n.broadcast_id && !n.broadcast_id.includes("|"))
      ? { broadcast_id: n.broadcast_id }
      : { id: n.id };
    const res = await fetch("/api/delete-notification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return;
    setSentHistory((prev) => prev.filter((x) => x.broadcast_id !== n.broadcast_id));
  }

  async function updateHistory(n: SentNotification, patch: Partial<SentNotification>) {
    if (n.broadcast_id && !n.broadcast_id.includes("|")) {
      await supabase.from("notification_logs").update({
        title: patch.title,
        body: patch.body,
        location: patch.location,
        priority: patch.priority,
      }).eq("broadcast_id", n.broadcast_id);
    } else {
      await supabase.from("notification_logs").update({
        title: patch.title,
        body: patch.body,
        location: patch.location,
        priority: patch.priority,
      }).eq("id", n.id);
    }
    setSentHistory((prev) => prev.map((x) => x.broadcast_id === n.broadcast_id ? { ...x, ...patch } : x));
  }

  return (
    <main className="p-6 lg:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold text-zinc-50">Send Notification</h1>

        {/* Compose */}
        <div className="rounded-xl bg-zinc-900 p-5 space-y-4">
          <div className="flex gap-2">
            {(["routine", "critical"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPriority(p)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  priority === p
                    ? p === "critical" ? "bg-red-600 text-white" : "bg-[#E94E1B] text-white"
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
          <div className="font-semibold text-zinc-100">Send to</div>
          <div className="flex flex-wrap gap-2">
            {(["ALL", "WATER", "WILDERNESS", "MRU", "SUPPORT", "CUSTOM"] as const).map((g) => (
              <button key={g} onClick={() => setGroup(g)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  group === g ? "bg-[#E94E1B] text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                }`}>
                {g}
              </button>
            ))}
          </div>

          {group === "CUSTOM" && (
            <div className="space-y-3">
              <input
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search members…"
                className="w-full rounded-lg bg-black px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-[#E94E1B] placeholder-zinc-600"
              />
              <div className="max-h-60 overflow-y-auto rounded-lg border border-zinc-800 divide-y divide-zinc-800">
                {filteredMembers.map((m) => (
                  <button key={m.id} onClick={() => toggleMember(m.id)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-zinc-800 transition">
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
                <HistoryCard
                  key={n.broadcast_id}
                  notif={n}
                  fmt={fmt}
                  onDelete={() => void deleteHistory(n)}
                  onUpdate={(patch) => void updateHistory(n, patch)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function HistoryCard({
  notif,
  fmt,
  onDelete,
  onUpdate,
}: {
  notif: SentNotification;
  fmt: (d: string) => string;
  onDelete: () => void;
  onUpdate: (patch: Partial<SentNotification>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(notif.title);
  const [body, setBody] = useState(notif.body ?? "");
  const [location, setLocation] = useState(notif.location ?? "");
  const [priority, setPriority] = useState(notif.priority ?? "routine");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function save() {
    setSaving(true);
    const patch = { title: title.trim(), body: body.trim() || null, location: location.trim() || null, priority };
    onUpdate(patch);
    setSaving(false);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="rounded-xl bg-zinc-900 p-4 space-y-3">
        <div className="flex gap-2">
          {(["routine", "critical"] as const).map((p) => (
            <button key={p} onClick={() => setPriority(p)}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                priority === p ? p === "critical" ? "bg-red-600 text-white" : "bg-[#E94E1B] text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}>
              {p === "routine" ? "Routine" : "⚠ Critical"}
            </button>
          ))}
        </div>
        <input value={title} onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg bg-black px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-[#E94E1B] placeholder-zinc-600"
          placeholder="Title" />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2}
          className="w-full rounded-lg bg-black px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-[#E94E1B] placeholder-zinc-600 resize-none"
          placeholder="Description (optional)" />
        <input value={location} onChange={(e) => setLocation(e.target.value)}
          className="w-full rounded-lg bg-black px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-[#E94E1B] placeholder-zinc-600"
          placeholder="Location (optional)" />
        <div className="flex gap-2">
          <button onClick={() => void save()} disabled={saving || !title.trim()}
            className="rounded-lg bg-[#E94E1B] px-4 py-1.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50 transition">
            {saving ? "Saving…" : "Save"}
          </button>
          <button onClick={() => setEditing(false)}
            className="rounded-lg bg-zinc-800 px-4 py-1.5 text-sm text-zinc-400 hover:bg-zinc-700 transition">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-zinc-900 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              notif.priority === "critical" ? "bg-red-600/20 text-red-400" : "bg-zinc-700 text-zinc-400"
            }`}>
              {notif.priority === "critical" ? "⚠ Critical" : "Routine"}
            </span>
            <span className="font-semibold text-zinc-100">{notif.title}</span>
          </div>
          {notif.body && <p className="text-sm text-zinc-400">{notif.body}</p>}
          {notif.location && <p className="text-xs text-zinc-500">📍 {notif.location}</p>}
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          <div className="text-xs text-zinc-500">{fmt(notif.created_at)}</div>
          <div className="text-xs text-zinc-600">{notif.recipient_count} recipient{notif.recipient_count !== 1 ? "s" : ""}</div>
          <div className="flex items-center gap-1 mt-1">
            <button onClick={() => setEditing(true)}
              className="rounded-md p-1.5 bg-zinc-800 hover:bg-zinc-700 transition text-zinc-400" aria-label="Edit">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            {confirmDelete ? (
              <>
                <button onClick={onDelete}
                  className="rounded-md px-2 py-1 text-xs font-semibold bg-red-600 text-white hover:bg-red-500 transition">
                  Confirm
                </button>
                <button onClick={() => setConfirmDelete(false)}
                  className="rounded-md px-2 py-1 text-xs bg-zinc-800 text-zinc-400 hover:bg-zinc-700 transition">
                  Cancel
                </button>
              </>
            ) : (
              <button onClick={() => setConfirmDelete(true)}
                className="rounded-md p-1.5 bg-zinc-800 hover:bg-zinc-700 transition text-zinc-400" aria-label="Delete">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
