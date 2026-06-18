"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";

const EVENT_TYPES = ["Non-Emergency Event", "Training", "Standby Coverage", "Community Event", "Meeting"];
const STATUSES = ["Scheduled", "Active", "Completed", "Cancelled"];

type EventRow = {
  id: string;
  title: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  location_name: string | null;
  address: string | null;
  event_type: string | null;
  notes: string | null;
  status: string | null;
  created_at: string;
};

type User = { id: string; full_name: string | null; call_sign: string | null };

const blank = (): Omit<EventRow, "id" | "created_at"> => ({
  title: "",
  event_date: "",
  start_time: null,
  end_time: null,
  location_name: null,
  address: null,
  event_type: "Non-Emergency Event",
  notes: null,
  status: "Scheduled",
});

export default function AdminEventsPage() {
  const toast = useToast();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(blank());
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"upcoming" | "all" | "past">("upcoming");

  // Unit selection
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [unitMode, setUnitMode] = useState<"all" | "specific" | "none">("all");
  const [selectedUnitIds, setSelectedUnitIds] = useState<Set<string>>(new Set());
  const [unitSearch, setUnitSearch] = useState("");

  useEffect(() => {
    void load();
    supabase.from("users").select("id,full_name,call_sign").order("call_sign").then(({ data }) => {
      setAllUsers((data ?? []) as User[]);
    });
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("events").select("*").order("event_date", { ascending: false });
    setEvents((data as EventRow[]) ?? []);
    setLoading(false);
  }

  function startCreate() {
    setEditingId(null);
    setForm(blank());
    setUnitMode("all");
    setSelectedUnitIds(new Set());
    setUnitSearch("");
    setShowForm(true);
    setTimeout(() => document.getElementById("event-title")?.focus(), 50);
  }

  async function startEdit(e: EventRow) {
    setEditingId(e.id);
    setForm({
      title: e.title,
      event_date: e.event_date,
      start_time: e.start_time,
      end_time: e.end_time,
      location_name: e.location_name,
      address: e.address,
      event_type: e.event_type,
      notes: e.notes,
      status: e.status,
    });
    // Load existing unit assignments
    const { data: existing } = await supabase.from("event_unit_assignments").select("user_id").eq("event_id", e.id);
    const ids = new Set((existing ?? []).map((r: any) => r.user_id as string));
    if (ids.size === 0) {
      setUnitMode("none");
    } else {
      setUnitMode("specific");
      setSelectedUnitIds(ids);
    }
    setUnitSearch("");
    setShowForm(true);
    setTimeout(() => document.getElementById("event-title")?.focus(), 50);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
  }

  function toggleUnit(userId: string) {
    setSelectedUnitIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
  }

  async function save() {
    if (!form.title.trim()) { toast("Title is required.", "error"); return; }
    if (!form.event_date) { toast("Date is required.", "error"); return; }
    setSaving(true);

    const payload = {
      title: form.title.trim(),
      event_date: form.event_date,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      location_name: form.location_name?.trim() || null,
      address: form.address?.trim() || null,
      event_type: form.event_type || "Non-Emergency Event",
      notes: form.notes?.trim() || null,
      status: form.status || "Scheduled",
    };

    let eventId = editingId;
    if (editingId) {
      const { error } = await supabase.from("events").update(payload).eq("id", editingId);
      if (error) { setSaving(false); toast(error.message, "error"); return; }
    } else {
      const { data: authData } = await supabase.auth.getUser();
      const email = authData.user?.email;
      let createdBy: string | null = null;
      if (email) {
        const { data: u } = await supabase.from("users").select("id").ilike("email", email).maybeSingle();
        createdBy = u?.id ?? null;
      }
      const { data: created, error } = await supabase.from("events").insert({ ...payload, created_by: createdBy }).select("id").single();
      if (error || !created) { setSaving(false); toast(error?.message ?? "Failed", "error"); return; }
      eventId = created.id;
    }

    // Sync unit assignments
    if (eventId) {
      await supabase.from("event_unit_assignments").delete().eq("event_id", eventId);
      const idsToAssign: string[] = unitMode === "all"
        ? allUsers.map((u) => u.id)
        : unitMode === "specific"
        ? Array.from(selectedUnitIds)
        : [];
      if (idsToAssign.length > 0) {
        await supabase.from("event_unit_assignments").insert(
          idsToAssign.map((uid) => ({ event_id: eventId, user_id: uid }))
        );
      }
    }

    setSaving(false);
    toast(editingId ? "Event updated." : "Event created.", "success");
    cancelForm();
    await load();
  }

  async function deleteEvent(id: string, title: string) {
    if (!window.confirm(`Delete "${title}"?`)) return;
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) { toast(error.message, "error"); return; }
    toast("Deleted.", "success");
    await load();
  }

  function fmt(e: EventRow) {
    const date = new Date(`${e.event_date}T00:00:00`).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: "numeric" });
    const start = e.start_time ? fmtTime(e.start_time) : null;
    const end = e.end_time ? fmtTime(e.end_time) : null;
    return `${date}${start ? ` • ${start}` : ""}${end ? ` – ${end}` : ""}`;
  }

  function fmtTime(t: string) {
    const [h, m] = t.split(":");
    const d = new Date(); d.setHours(+h, +m, 0, 0);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  const today = new Date().toISOString().slice(0, 10);
  const filtered = events.filter((e) => {
    if (filter === "upcoming") return e.event_date >= today && e.status !== "Cancelled";
    if (filter === "past") return e.event_date < today;
    return true;
  });

  const statusColor: Record<string, string> = {
    Scheduled: "bg-blue-950/60 text-blue-300",
    Active: "bg-green-950/60 text-green-300",
    Completed: "bg-gray-800 text-gray-400",
    Cancelled: "bg-red-950/60 text-red-400",
  };

  const filteredUsers = allUsers.filter((u) => {
    const q = unitSearch.toLowerCase();
    return !q || (u.call_sign ?? "").toLowerCase().includes(q) || (u.full_name ?? "").toLowerCase().includes(q);
  });

  return (
    <main className="p-6 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-zinc-50">Events</h1>
          <button onClick={startCreate} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-500">
            + Create Event
          </button>
        </div>

        {/* Create / Edit form */}
        {showForm && (
          <section className="rounded-xl border border-gray-700 bg-gray-900 p-5 space-y-3">
            <div className="text-lg font-semibold">{editingId ? "Edit Event" : "New Event"}</div>

            <input id="event-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Event title *" className="w-full rounded-lg bg-black px-4 py-3 outline-none focus:ring-1 focus:ring-red-600" />

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs text-gray-500">Date *</label>
                <input type="date" value={form.event_date ?? ""} onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                  className="w-full rounded-lg bg-black px-4 py-3 outline-none focus:ring-1 focus:ring-red-600" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Start time</label>
                <input type="time" value={form.start_time ?? ""} onChange={(e) => setForm({ ...form, start_time: e.target.value || null })}
                  className="w-full rounded-lg bg-black px-4 py-3 outline-none focus:ring-1 focus:ring-red-600" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">End time</label>
                <input type="time" value={form.end_time ?? ""} onChange={(e) => setForm({ ...form, end_time: e.target.value || null })}
                  className="w-full rounded-lg bg-black px-4 py-3 outline-none focus:ring-1 focus:ring-red-600" />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-gray-500">Type</label>
                <select value={form.event_type ?? "Non-Emergency Event"} onChange={(e) => setForm({ ...form, event_type: e.target.value })}
                  className="w-full rounded-lg bg-black px-4 py-3 outline-none focus:ring-1 focus:ring-red-600">
                  {EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Status</label>
                <select value={form.status ?? "Scheduled"} onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full rounded-lg bg-black px-4 py-3 outline-none focus:ring-1 focus:ring-red-600">
                  {STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <input value={form.location_name ?? ""} onChange={(e) => setForm({ ...form, location_name: e.target.value || null })}
              placeholder="Location name" className="w-full rounded-lg bg-black px-4 py-3 outline-none focus:ring-1 focus:ring-red-600" />

            <input value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value || null })}
              placeholder="Address" className="w-full rounded-lg bg-black px-4 py-3 outline-none focus:ring-1 focus:ring-red-600" />

            <textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value || null })}
              placeholder="Notes" rows={3}
              className="w-full rounded-lg bg-black px-4 py-3 outline-none focus:ring-1 focus:ring-red-600" />

            {/* Unit selection */}
            <div className="space-y-2 rounded-lg border border-zinc-700 bg-zinc-950 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Invited Units</div>
              <div className="flex gap-2">
                {(["all", "specific", "none"] as const).map((m) => (
                  <button key={m} type="button" onClick={() => setUnitMode(m)}
                    className={`rounded-lg px-3 py-1.5 text-sm capitalize transition ${unitMode === m ? "bg-red-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
                    {m === "all" ? `All (${allUsers.length})` : m === "specific" ? "Select" : "None"}
                  </button>
                ))}
              </div>
              {unitMode === "specific" && (
                <div className="space-y-2">
                  <input value={unitSearch} onChange={(e) => setUnitSearch(e.target.value)}
                    placeholder="Search by name or call sign…"
                    className="w-full rounded-lg bg-black px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-red-600" />
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-zinc-700 divide-y divide-zinc-800">
                    {filteredUsers.map((u) => {
                      const sel = selectedUnitIds.has(u.id);
                      return (
                        <label key={u.id} className={`flex cursor-pointer items-center gap-3 px-3 py-2 text-sm transition ${sel ? "bg-red-950/30" : "hover:bg-zinc-800"}`}>
                          <input type="checkbox" checked={sel} onChange={() => toggleUnit(u.id)} className="accent-red-600" />
                          <span className="font-mono text-zinc-100">{u.call_sign ?? "—"}</span>
                          <span className="text-zinc-400">{u.full_name}</span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="text-xs text-zinc-500">{selectedUnitIds.size} selected</div>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button onClick={() => void save()} disabled={saving}
                className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold disabled:opacity-60 hover:bg-red-500">
                {saving ? "Saving…" : editingId ? "Save Changes" : "Create Event"}
              </button>
              <button onClick={cancelForm} className="rounded-lg bg-gray-800 px-5 py-2.5 text-sm hover:bg-gray-700">
                Cancel
              </button>
            </div>
          </section>
        )}

        {/* Filter */}
        <div className="flex gap-2">
          {(["upcoming", "all", "past"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-sm capitalize ${filter === f ? "bg-red-600 text-white" : "bg-gray-800 text-gray-400"}`}>
              {f}
            </button>
          ))}
          <span className="ml-auto self-center text-sm text-gray-500">{filtered.length} event{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {/* List */}
        {loading ? (
          <div className="animate-pulse space-y-2">
            {[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-gray-900" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl bg-gray-900 p-8 text-center text-gray-500">No events.</div>
        ) : (
          <div className="space-y-2">
            {filtered.map((e) => (
              <div key={e.id} className="rounded-xl bg-gray-900 p-4">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/admin/events/${e.id}`} className="min-w-0 flex-1 hover:opacity-80 transition">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{e.title}</span>
                      <span className={`rounded px-2 py-0.5 text-xs ${statusColor[e.status ?? "Scheduled"] ?? "bg-gray-800 text-gray-400"}`}>
                        {e.status ?? "Scheduled"}
                      </span>
                      {e.event_type && <span className="text-xs text-gray-500">{e.event_type}</span>}
                    </div>
                    <div className="mt-1 text-sm text-gray-400">{fmt(e)}</div>
                    {(e.location_name || e.address) && (
                      <div className="mt-0.5 text-sm text-gray-500">{e.location_name ?? e.address}</div>
                    )}
                    {e.notes && <div className="mt-1 text-xs text-gray-600 line-clamp-2">{e.notes}</div>}
                  </Link>
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => void startEdit(e)} className="rounded bg-gray-700 px-3 py-1.5 text-xs hover:bg-gray-600">Edit</button>
                    <button onClick={() => void deleteEvent(e.id, e.title)} className="rounded bg-red-950/60 px-3 py-1.5 text-xs text-red-400 hover:bg-red-900/60">Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
