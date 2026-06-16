"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import { logAudit } from "@/lib/audit";

type Member = { id: string; full_name: string | null; call_sign: string | null };

export default function AdminAlertsPage() {
  const toast = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("/");
  const [critical, setCritical] = useState(false);
  const [target, setTarget] = useState<"all" | "duty" | "specific">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [memberSearch, setMemberSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [sentCount, setSentCount] = useState<number | null>(null);

  useEffect(() => {
    void supabase
      .from("users")
      .select("id,full_name,call_sign")
      .order("call_sign")
      .then(({ data }) => setMembers((data ?? []) as Member[]));
  }, []);

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
    setSentCount(null);

    let ok = 0;
    await Promise.all(
      targetIds.map(async (user_id) => {
        const res = await fetch("/api/send-push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id, title: title.trim(), body: body.trim() || undefined, url: url || "/", critical }),
        });
        if (res.ok) ok++;
      })
    );

    setSending(false);
    setSentCount(ok);
    toast(`Alert sent to ${ok} member${ok !== 1 ? "s" : ""}.`, "success");

    void logAudit({
      action: "send_alert",
      entity_type: "alert",
      entity_label: title.trim(),
      details: { target, recipient_count: ok, critical },
    });
  }

  return (
    <main className="p-6 lg:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold text-zinc-50">Send Alert</h1>

        <div className="rounded-xl bg-zinc-900 p-5 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-400">Title *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Alert title…"
              className="w-full rounded-lg bg-black px-3 py-2.5 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-red-600 placeholder-zinc-600"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-400">Message (optional)</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Additional details…"
              rows={3}
              className="w-full rounded-lg bg-black px-3 py-2.5 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-red-600 placeholder-zinc-600 resize-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-400">Link URL</label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="/"
              className="w-full rounded-lg bg-black px-3 py-2.5 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-red-600 placeholder-zinc-600"
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={critical}
              onChange={(e) => setCritical(e.target.checked)}
              className="h-4 w-4 accent-red-600"
            />
            <span className="text-sm text-zinc-300">Critical alert (overrides silent/DND on iOS)</span>
          </label>
        </div>

        <div className="rounded-xl bg-zinc-900 p-5 space-y-4">
          <div className="font-semibold text-zinc-100">Recipients</div>

          <div className="flex flex-wrap gap-2">
            {(["all", "duty", "specific"] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setTarget(opt)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  target === opt
                    ? "bg-red-600 text-white"
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
                className="w-full rounded-lg bg-black px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-red-600 placeholder-zinc-600"
              />
              <div className="max-h-60 overflow-y-auto rounded-lg border border-zinc-800 divide-y divide-zinc-800">
                {filteredMembers.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => toggleMember(m.id)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-zinc-800 transition"
                  >
                    <span className={`h-4 w-4 rounded border-2 shrink-0 transition ${
                      selectedIds.has(m.id) ? "bg-red-600 border-red-600" : "border-zinc-600"
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

        <div className="flex items-center justify-between gap-4">
          {sentCount !== null && (
            <span className="text-sm text-green-400">Sent to {sentCount} member{sentCount !== 1 ? "s" : ""}.</span>
          )}
          <button
            onClick={() => void send()}
            disabled={sending || !title.trim()}
            className="ml-auto rounded-xl bg-red-600 px-6 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition"
          >
            {sending ? "Sending…" : "Send Alert"}
          </button>
        </div>
      </div>
    </main>
  );
}
