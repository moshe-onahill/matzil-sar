"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";

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
};

type AttendanceRow = {
  id: string;
  user_id: string;
  signed_in_at: string | null;
  signed_out_at: string | null;
  sign_in_lat: number | null;
  sign_in_lng: number | null;
  sign_out_lat: number | null;
  sign_out_lng: number | null;
  user: { full_name: string | null; call_sign: string | null } | null;
};

type AllUser = { id: string; full_name: string | null; call_sign: string | null };

function fmtDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString([], {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

function fmtTime(t: string | null) {
  if (!t) return null;
  const [h, m] = t.split(":");
  const d = new Date(); d.setHours(+h, +m, 0, 0);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtTs(ts: string | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function coordLink(lat: number | null, lng: number | null) {
  if (!lat || !lng) return null;
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export default function AdminEventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();

  const [event, setEvent] = useState<EventRow | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [allUsers, setAllUsers] = useState<AllUser[]>([]);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [userSearch, setUserSearch] = useState("");
  const [searchResults, setSearchResults] = useState<AllUser[]>([]);
  const [loading, setLoading] = useState(true);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void loadAll();
    const channel = supabase
      .channel(`event-attendance-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_attendance", filter: `event_id=eq.${id}` }, () => void loadAll())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [id]);

  async function loadAll() {
    const [eventRes, attRes, invRes] = await Promise.all([
      supabase.from("events").select("id,title,event_date,start_time,end_time,location_name,address,event_type,notes,status").eq("id", id).single(),
      supabase.from("event_attendance").select("id,user_id,signed_in_at,signed_out_at,sign_in_lat,sign_in_lng,sign_out_lat,sign_out_lng,user:users(full_name,call_sign)").eq("event_id", id).order("signed_in_at"),
      supabase.from("event_invites").select("user_id").eq("event_id", id),
    ]);

    setEvent(eventRes.data as EventRow);
    setAttendance(((attRes.data ?? []) as any[]).map((r) => ({
      ...r,
      user: Array.isArray(r.user) ? r.user[0] ?? null : r.user,
    })));
    setInvitedIds(new Set((invRes.data ?? []).map((r: any) => r.user_id)));
    setLoading(false);
  }

  function onSearchChange(val: string) {
    setUserSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!val.trim()) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      const { data } = await supabase.from("users")
        .select("id,full_name,call_sign")
        .or(`full_name.ilike.%${val}%,call_sign.ilike.%${val}%`)
        .limit(8);
      setSearchResults((data ?? []) as AllUser[]);
    }, 300);
  }

  async function deleteAttendance(attendanceId: string) {
    const { error } = await supabase.from("event_attendance").delete().eq("id", attendanceId);
    if (error) toast(error.message, "error");
  }

  async function toggleInvite(userId: string) {
    const next = new Set(invitedIds);
    if (next.has(userId)) next.delete(userId); else next.add(userId);
    setInvitedIds(next);
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_invites", event_id: id, user_ids: [...next] }),
    });
    if (!res.ok) toast("Failed to update invites.", "error");
    else toast(next.has(userId) ? "Invited." : "Removed.", "success");
  }

  function exportICS() {
    if (!event) return;
    const dt = event.event_date.replace(/-/g, "");
    const startT = event.start_time ? event.start_time.replace(":", "") + "00" : "000000";
    const endT = event.end_time ? event.end_time.replace(":", "") + "00" : startT;
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Matzil SAR//EN",
      "BEGIN:VEVENT",
      `DTSTART:${dt}T${startT}`,
      `DTEND:${dt}T${endT}`,
      `SUMMARY:${event.title}`,
      event.location_name ? `LOCATION:${event.location_name}` : "",
      event.address ? `LOCATION:${event.address}` : "",
      event.notes ? `DESCRIPTION:${event.notes.replace(/\n/g, "\\n")}` : "",
      "END:VEVENT",
      "END:VCALENDAR",
    ].filter(Boolean).join("\r\n");
    const blob = new Blob([ics], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${event.title.replace(/\s+/g, "-")}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-red-500" />
      </main>
    );
  }

  if (!event) return <main className="p-6"><p className="text-zinc-500">Event not found.</p></main>;

  const presentCount = attendance.filter((a) => a.signed_in_at && !a.signed_out_at).length;
  const totalCount = attendance.length;

  return (
    <main className="p-6 lg:p-8">
      <div className="mx-auto max-w-3xl space-y-5">

        <div>
          <Link href="/admin/events" className="text-sm text-zinc-500 hover:text-zinc-300">← Events</Link>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-zinc-50">{event.title}</h1>
              <p className="text-sm text-zinc-400 mt-0.5">{event.event_type} · {event.status ?? "Scheduled"}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={exportICS}
                className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs hover:bg-zinc-700">
                Export ICS
              </button>
              <Link href={`/admin/events`} className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs hover:bg-zinc-700">
                Edit ↗
              </Link>
            </div>
          </div>
        </div>

        {/* Event details */}
        <section className="rounded-xl bg-zinc-900 p-5 space-y-2 text-sm">
          <div className="flex gap-3">
            <span className="w-20 text-zinc-500 shrink-0">Date</span>
            <span className="text-zinc-200">{fmtDate(event.event_date)}</span>
          </div>
          {(event.start_time || event.end_time) && (
            <div className="flex gap-3">
              <span className="w-20 text-zinc-500 shrink-0">Time</span>
              <span className="text-zinc-200">{fmtTime(event.start_time) ?? "—"}{event.end_time ? ` – ${fmtTime(event.end_time)}` : ""}</span>
            </div>
          )}
          {event.location_name && (
            <div className="flex gap-3">
              <span className="w-20 text-zinc-500 shrink-0">Location</span>
              <span className="text-zinc-200">{event.location_name}</span>
            </div>
          )}
          {event.address && (
            <div className="flex gap-3">
              <span className="w-20 text-zinc-500 shrink-0">Address</span>
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address)}`}
                target="_blank" rel="noopener noreferrer"
                className="text-blue-400 hover:underline">{event.address}</a>
            </div>
          )}
          {event.notes && (
            <div className="border-t border-zinc-800 pt-3 text-zinc-400 whitespace-pre-wrap">{event.notes}</div>
          )}
        </section>

        {/* Attendance log */}
        <section className="rounded-xl bg-zinc-900 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="font-semibold text-zinc-100">Attendance Log</div>
            <div className="text-sm text-zinc-500">{presentCount} present · {totalCount} total</div>
          </div>

          {attendance.length === 0 ? (
            <p className="text-sm text-zinc-600">No sign-ins yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-zinc-600 border-b border-zinc-800">
                    <th className="pb-2 pr-4 font-medium">Member</th>
                    <th className="pb-2 pr-4 font-medium">Sign In</th>
                    <th className="pb-2 pr-4 font-medium">Sign Out</th>
                    <th className="pb-2 pr-4 font-medium">Location</th>
                    <th className="pb-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {attendance.map((a) => (
                    <tr key={a.id}>
                      <td className="py-2.5 pr-4 font-mono text-zinc-200">
                        {a.user?.call_sign ?? a.user?.full_name ?? "—"}
                      </td>
                      <td className="py-2.5 pr-4 text-green-400">{fmtTs(a.signed_in_at)}</td>
                      <td className="py-2.5 pr-4 text-zinc-400">{fmtTs(a.signed_out_at)}</td>
                      <td className="py-2.5 pr-4">
                        {coordLink(a.sign_in_lat, a.sign_in_lng) ? (
                          <a href={coordLink(a.sign_in_lat, a.sign_in_lng)!} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-blue-400 hover:underline">Map ↗</a>
                        ) : <span className="text-zinc-700">—</span>}
                      </td>
                      <td className="py-2.5">
                        <button
                          onClick={() => void deleteAttendance(a.id)}
                          className="text-xs text-zinc-600 hover:text-red-400 transition"
                          title="Delete log — lets member sign in/out again">
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Invites / unit management */}
        <section className="rounded-xl bg-zinc-900 p-5 space-y-3">
          <div className="font-semibold text-zinc-100">Invited Units</div>
          <p className="text-xs text-zinc-500">Members you invite will see this event highlighted. Search to add.</p>

          <div className="relative">
            <input value={userSearch} onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search by name or call sign…"
              className="w-full rounded-lg bg-black px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-red-600" />
          </div>

          {searchResults.length > 0 && (
            <div className="rounded-lg border border-zinc-700 bg-zinc-800 divide-y divide-zinc-700 overflow-hidden">
              {searchResults.map((u) => (
                <button key={u.id} onClick={() => void toggleInvite(u.id)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-zinc-700 transition">
                  <span className={`h-4 w-4 rounded border-2 shrink-0 ${invitedIds.has(u.id) ? "bg-red-600 border-red-600" : "border-zinc-600"}`} />
                  <span className="font-mono text-sm text-zinc-100">{u.call_sign ?? "—"}</span>
                  <span className="text-sm text-zinc-400">{u.full_name}</span>
                </button>
              ))}
            </div>
          )}

          {invitedIds.size > 0 && (
            <div className="text-xs text-zinc-500">{invitedIds.size} unit{invitedIds.size !== 1 ? "s" : ""} invited</div>
          )}
        </section>

      </div>
    </main>
  );
}
