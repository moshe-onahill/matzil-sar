"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import { getCurrentTestEmail } from "@/lib/dev-user";

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

type Attendance = {
  id: string;
  signed_in_at: string | null;
  signed_out_at: string | null;
};

const TYPE_COLOR: Record<string, string> = {
  Training: "bg-purple-950/60 text-purple-300",
  "Non-Emergency Event": "bg-blue-950/60 text-blue-300",
  "Standby Coverage": "bg-yellow-950/60 text-yellow-300",
  Meeting: "bg-green-950/60 text-green-300",
  "Community Event": "bg-teal-950/60 text-teal-300",
};

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

async function eventsApi(body: object) {
  const res = await fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed");
  return data;
}

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();

  const [event, setEvent] = useState<EventRow | null>(null);
  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  useEffect(() => { void loadAll(); }, [id]);

  async function loadAll() {
    const email = getCurrentTestEmail();
    let uid: string | null = null;
    if (email) {
      const { data: u } = await supabase.from("users").select("id").eq("email", email).single();
      uid = u?.id ?? null;
      setCurrentUserId(uid);
    }

    const [eventRes, attRes] = await Promise.all([
      supabase.from("events").select("id,title,event_date,start_time,end_time,location_name,address,event_type,notes,status").eq("id", id).single(),
      uid ? supabase.from("event_attendance").select("id,signed_in_at,signed_out_at").eq("event_id", id).eq("user_id", uid).maybeSingle() : Promise.resolve({ data: null }),
    ]);

    setEvent(eventRes.data as EventRow);
    setAttendance(attRes.data as Attendance | null);
    setLoading(false);
  }

  function getLocation(): Promise<{ lat: number; lng: number } | null> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) { resolve(null); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 8000 }
      );
    });
  }

  async function signIn() {
    if (!currentUserId) return;
    setActing(true);
    const loc = await getLocation();
    try {
      await eventsApi({ action: "sign_in", event_id: id, user_id: currentUserId, lat: loc?.lat, lng: loc?.lng });
      toast("Signed in.", "success");
      await loadAll();
    } catch (e: any) { toast(e.message, "error"); }
    setActing(false);
  }

  async function signOut() {
    if (!currentUserId) return;
    setActing(true);
    const loc = await getLocation();
    try {
      await eventsApi({ action: "sign_out", event_id: id, user_id: currentUserId, lat: loc?.lat, lng: loc?.lng });
      toast("Signed out.", "success");
      await loadAll();
    } catch (e: any) { toast(e.message, "error"); }
    setActing(false);
  }

  function navUrl() {
    if (!event) return null;
    const q = encodeURIComponent(event.address ?? event.location_name ?? "");
    if (!q) return null;
    return `https://www.google.com/maps/search/?api=1&query=${q}`;
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-red-500" />
      </main>
    );
  }

  if (!event) {
    return (
      <main className="min-h-screen bg-black px-4 py-6 text-white">
        <p className="text-zinc-500">Event not found.</p>
      </main>
    );
  }

  const nav = navUrl();
  const signedIn = !!attendance?.signed_in_at;
  const signedOut = !!attendance?.signed_out_at;

  return (
    <main className="min-h-screen bg-black px-4 py-6 pb-28 text-white">
      <div className="mx-auto max-w-xl space-y-5">
        <div>
          <Link href="/events" className="text-sm text-zinc-500 hover:text-zinc-300">← Calendar</Link>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-2">
            <h1 className="text-2xl font-bold text-zinc-50">{event.title}</h1>
            <span className={`rounded-lg px-2.5 py-1 text-xs font-medium ${TYPE_COLOR[event.event_type ?? ""] ?? "bg-zinc-800 text-zinc-400"}`}>
              {event.event_type ?? "Event"}
            </span>
          </div>
        </div>

        {/* Details card */}
        <section className="rounded-xl bg-zinc-900 p-5 space-y-3">
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center gap-2 text-zinc-300">
              <span className="text-zinc-500 w-16 shrink-0">Date</span>
              <span>{fmtDate(event.event_date)}</span>
            </div>
            {(event.start_time || event.end_time) && (
              <div className="flex items-center gap-2 text-zinc-300">
                <span className="text-zinc-500 w-16 shrink-0">Time</span>
                <span>
                  {fmtTime(event.start_time) ?? "—"}
                  {event.end_time ? ` – ${fmtTime(event.end_time)}` : ""}
                </span>
              </div>
            )}
            {event.location_name && (
              <div className="flex items-center gap-2 text-zinc-300">
                <span className="text-zinc-500 w-16 shrink-0">Location</span>
                <span>{event.location_name}</span>
              </div>
            )}
            {event.address && (
              <div className="flex items-center gap-2 text-zinc-300">
                <span className="text-zinc-500 w-16 shrink-0">Address</span>
                <span>{event.address}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-zinc-300">
              <span className="text-zinc-500 w-16 shrink-0">Status</span>
              <span>{event.status ?? "Scheduled"}</span>
            </div>
          </div>

          {event.notes && (
            <div className="border-t border-zinc-800 pt-3 text-sm text-zinc-400 whitespace-pre-wrap">{event.notes}</div>
          )}
        </section>

        {/* Navigation */}
        {nav && (
          <a href={nav} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 py-3 text-sm font-medium text-zinc-200 hover:bg-zinc-800 transition">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            Navigate to {event.location_name ?? event.address}
          </a>
        )}

        {/* Sign in / out */}
        <section className="rounded-xl bg-zinc-900 p-5 space-y-3">
          <div className="font-semibold text-zinc-100">Attendance</div>

          {signedIn && (
            <div className="text-sm space-y-1">
              <div className="text-green-400">
                Signed in at {new Date(attendance!.signed_in_at!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
              {signedOut && (
                <div className="text-zinc-400">
                  Signed out at {new Date(attendance!.signed_out_at!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            {!signedIn && (
              <button onClick={() => void signIn()} disabled={acting}
                className="flex-1 rounded-xl bg-green-700 py-3 text-sm font-semibold hover:bg-green-600 disabled:opacity-60">
                {acting ? "…" : "Sign In"}
              </button>
            )}
            {signedIn && !signedOut && (
              <button onClick={() => void signOut()} disabled={acting}
                className="flex-1 rounded-xl bg-zinc-700 py-3 text-sm font-semibold hover:bg-zinc-600 disabled:opacity-60">
                {acting ? "…" : "Sign Out"}
              </button>
            )}
            {signedOut && (
              <div className="flex-1 rounded-xl border border-zinc-700 py-3 text-center text-sm text-zinc-500">
                Attendance logged
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
