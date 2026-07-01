"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentTestEmail, getStoredRole } from "@/lib/dev-user";

type Profile = {
  id: string;
  full_name: string | null;
  email: string;
  call_sign: string | null;
  teams: string[];
};

type Notif = {
  id: string;
  broadcast_id: string | null;
  title: string;
  body: string | null;
  location: string | null;
  priority: string | null;
  created_at: string;
  sender_id: string | null;
  sender_name: string | null;
  sender_unit: string | null;
};

const ADMIN_ROLES = ["Dispatcher", "SAR Manager", "Global Admin"];

const ALL_GROUPS = ["ALL", "WILDERNESS", "WATER", "MRU", "SUPPORT", "MEDICAL", "DISPATCH", "SAR MANAGERS", "TRAINEES"] as const;
type AlertGroup = typeof ALL_GROUPS[number];

export default function V1Shell() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeCall, setActiveCall] = useState<Notif | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [view, setView] = useState<"main" | "compose">("main");
  const [editingCall, setEditingCall] = useState<Notif | null>(null);
  const [criticalAlert, setCriticalAlert] = useState<Notif | null>(null);
  const role = getStoredRole();
  const isAdmin = ADMIN_ROLES.includes(role);

  useEffect(() => { void init(); }, []);

  // Show in-app popup when app is opened from a background FCM notification
  useEffect(() => {
    async function checkPendingAlert() {
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform()) return;
      try {
        const result = await (Capacitor as any).Plugins.AlertSettings.getPendingAlert();
        if (result?.found) {
          setCriticalAlert({ id: "pending", broadcast_id: null, title: result.title, body: result.body, location: result.location, priority: "critical", created_at: new Date().toISOString(), sender_id: null, sender_name: null, sender_unit: null });
          await (Capacitor as any).Plugins.AlertSettings.clearPendingAlert();
        }
      } catch { /* ignore on web */ }
    }
    void checkPendingAlert();
    import("@capacitor/app").then(({ App }) => {
      App.addListener("appStateChange", ({ isActive }) => { if (isActive) void checkPendingAlert(); });
    });
  }, []);

  useEffect(() => {
    if (!profile?.id) return;
    const uid = profile.id;
    const insertFilter = isAdmin ? undefined : `user_id=eq.${uid}`;
    const channel = supabase
      .channel("v1-notifs")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notification_logs", ...(insertFilter ? { filter: insertFilter } : {}) },
        (payload) => {
          const n = payload.new as Notif;
          if (n.priority === "critical") setCriticalAlert({ ...n, sender_name: null, sender_unit: null });
          void loadActiveCall(uid, isAdmin);
        }
      )
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "notification_logs", ...(insertFilter ? { filter: insertFilter } : {}) },
        () => void loadActiveCall(uid, isAdmin)
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.id, isAdmin]);

  async function init() {
    const email = getCurrentTestEmail();
    const { data: user } = await supabase
      .from("users")
      .select("id, full_name, email, call_sign, user_units(units(name))")
      .eq("email", email)
      .single();

    if (user) {
      const teams = ((user as any).user_units ?? [])
        .flatMap((uu: any) => {
          const u = uu.units;
          return Array.isArray(u) ? u.map((x: any) => x.name) : u?.name ? [u.name] : [];
        });
      const p: Profile = { ...(user as any), teams };
      setProfile(p);
      await loadActiveCall((user as any).id, ADMIN_ROLES.includes(getStoredRole()));
    }
    setLoading(false);
  }

  async function loadActiveCall(uid: string, adminLoad = false) {
    let query = supabase
      .from("notification_logs")
      .select("id,broadcast_id,title,body,location,priority,created_at,sender_id,sender_name,sender_unit")
      .order("created_at", { ascending: false })
      .limit(50);

    if (!adminLoad) query = query.eq("user_id", uid);

    const { data } = await query;

    // Deduplicate by broadcast_id, take most recent
    const seen = new Set<string>();
    const deduped: Notif[] = [];
    for (const n of (data ?? []) as any[]) {
      const key = n.broadcast_id ?? n.id;
      if (!seen.has(key)) { seen.add(key); deduped.push({ ...n, sender_name: n.sender_name ?? null, sender_unit: n.sender_unit ?? null }); }
    }

    // Enrich missing sender info from users table
    const needsLookup = deduped.filter(n => n.sender_id && !n.sender_name);
    if (needsLookup.length > 0) {
      const { data: senders } = await supabase
        .from("users")
        .select("id,full_name,call_sign,user_units(units(name))")
        .in("id", needsLookup.map(n => n.sender_id!));
      const senderMap = new Map<string, { name: string | null; unit: string | null }>();
      for (const s of (senders ?? []) as any[]) {
        const units = (s.user_units ?? []).flatMap((uu: any) => { const u = uu.units; return Array.isArray(u) ? u.map((x: any) => x.name) : u?.name ? [u.name] : []; });
        senderMap.set(s.id, { name: s.full_name ?? s.call_sign ?? null, unit: units[0] ?? null });
      }
      for (const n of deduped) {
        if (n.sender_id && !n.sender_name && senderMap.has(n.sender_id)) {
          const info = senderMap.get(n.sender_id)!;
          n.sender_name = info.name;
          n.sender_unit = info.unit;
        }
      }
    }

    setActiveCall(deduped[0] ?? null);
  }

  async function closeCall(n: Notif) {
    const filter = n.broadcast_id ? { broadcast_id: n.broadcast_id } : { id: n.id };
    await fetch("/api/delete-notification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(filter),
    });
    setActiveCall(null);
    if (profile?.id) void loadActiveCall(profile.id, isAdmin);
  }

  function openMaps(location: string) {
    const url = location.startsWith("http")
      ? location
      : `https://maps.google.com/?q=${encodeURIComponent(location)}`;
    window.open(url, "_blank");
  }

  async function logout() {
    localStorage.removeItem("auth-email");
    localStorage.removeItem("real-role");
    localStorage.removeItem("dev-role");
    localStorage.removeItem("session-temporary");
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-800 border-t-[#E94E1B]" />
      </div>
    );
  }

  if (view === "compose") {
    return (
      <ComposeScreen
        profile={profile}
        editingCall={editingCall}
        onClose={() => { setView("main"); setEditingCall(null); }}
        onSent={() => {
          setView("main");
          setEditingCall(null);
          if (profile?.id) void loadActiveCall(profile.id, isAdmin);
        }}
      />
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-black text-white">
      <AppHeader
        profile={profile}
        profileOpen={profileOpen}
        onProfileClick={() => setProfileOpen(v => !v)}
        onSignOut={() => void logout()}
      />

      {/* Main content */}
      <div className="flex flex-1 flex-col px-5 pt-6 pb-8">
        {activeCall ? (
          <div className="flex flex-1 flex-col gap-4">
            {/* Call message box */}
            <div className="flex-1 rounded-3xl bg-zinc-600 p-5 min-h-48">
              <p className="text-sm text-zinc-800 font-medium mb-3">Call Message</p>
              <p className="text-base text-black font-semibold leading-snug">{activeCall.title}</p>
              {activeCall.body && <p className="mt-2 text-sm text-zinc-900 leading-relaxed">{activeCall.body}</p>}
              {(activeCall.sender_name || activeCall.sender_unit) && (
                <p className="mt-3 text-xs text-zinc-700">
                  Sent by: {[activeCall.sender_name, activeCall.sender_unit].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>

            {/* Open Maps */}
            {activeCall.location && (
              <button
                onClick={() => openMaps(activeCall.location!)}
                className="w-full rounded-full bg-zinc-600 py-4 text-base font-bold text-black transition active:bg-zinc-500">
                Open Maps
              </button>
            )}

            {/* Admin controls */}
            {isAdmin && (
              <div className="mt-auto space-y-3 pt-2">
                <div className="flex justify-center">
                  <button
                    onClick={() => { setEditingCall(activeCall); setView("compose"); }}
                    className="rounded-full bg-zinc-700 px-8 py-3 text-sm font-bold text-zinc-300 transition active:bg-zinc-600">
                    EDIT CALL
                  </button>
                </div>
                <button
                  onClick={() => void closeCall(activeCall)}
                  className="w-full rounded-full bg-green-600 py-5 text-xl font-black text-black transition active:bg-green-500">
                  CLOSE CALL
                </button>
                <button
                  onClick={() => { setEditingCall(null); setView("compose"); }}
                  className="w-full rounded-full bg-red-600 py-5 text-xl font-black text-black transition active:bg-red-500">
                  NEW ALERT
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-1 flex-col">
            <div className="flex justify-center pt-4">
              <span className="rounded-full bg-zinc-700 px-8 py-3 text-sm font-bold text-black tracking-wider">
                NO CALLS
              </span>
            </div>
            {isAdmin && (
              <div className="mt-auto">
                <button
                  onClick={() => setView("compose")}
                  className="w-full rounded-full bg-red-600 py-5 text-xl font-black text-black transition active:bg-red-500">
                  SEND ALERT
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {criticalAlert && (
        <CriticalAlertPopup notif={criticalAlert} onDismiss={() => setCriticalAlert(null)} />
      )}
    </div>
  );
}

function AppHeader({ profile, profileOpen, onProfileClick, onSignOut }: {
  profile: Profile | null;
  profileOpen: boolean;
  onProfileClick: () => void;
  onSignOut: () => void;
}) {
  return (
    <div className="relative flex items-center justify-between px-4 pt-12 pb-4">
      {/* Matzil logo wordmark */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/matzil-words.avif" alt="Matzil Search & Rescue" className="h-10 object-contain" />

      {/* Profile button */}
      <div className="relative">
        <button
          onClick={onProfileClick}
          className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#E94E1B] text-[#E94E1B] transition active:opacity-70"
          aria-label="Profile"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
            <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
          </svg>
        </button>

        {/* Profile dropdown */}
        {profileOpen && (
          <div className="absolute right-0 top-14 z-50 w-52">
            <button
              onClick={onSignOut}
              className="w-full rounded-2xl bg-[#E94E1B] px-4 py-4 text-left transition active:bg-orange-600"
            >
              <div className="text-lg font-bold text-black">Sign-Out</div>
              {profile?.call_sign && (
                <div className="text-xs font-semibold text-black/70 mt-0.5">
                  Signed-In As: {profile.call_sign}
                </div>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ComposeScreen({ profile, editingCall, onClose, onSent }: {
  profile: Profile | null;
  editingCall: Notif | null;
  onClose: () => void;
  onSent: () => void;
}) {
  const [groupOpen, setGroupOpen] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<Set<AlertGroup>>(new Set(["ALL"]));
  const [message, setMessage] = useState(editingCall ? [editingCall.title, editingCall.body].filter(Boolean).join("\n") : "");
  const [stagingLink, setStagingLink] = useState(editingCall?.location ?? "");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  function toggleGroup(g: AlertGroup) {
    setSelectedGroups(prev => {
      const next = new Set(prev);
      if (g === "ALL") {
        return next.has("ALL") ? new Set() : new Set(["ALL"] as AlertGroup[]);
      }
      next.delete("ALL");
      next.has(g) ? next.delete(g) : next.add(g);
      return next;
    });
  }

  async function getTargetIds(): Promise<string[]> {
    const groups = [...selectedGroups];
    const includeAll = groups.length === 0 || groups.includes("ALL");
    if (includeAll) {
      const { data } = await supabase.from("users").select("id");
      return (data ?? []).map((r: any) => r.id);
    }
    const results = await Promise.all(
      groups.map((g) =>
        supabase.from("user_units").select("user_id, units!inner(name)").ilike("units.name", g)
          .then(({ data }) => (data ?? []).map((r: any) => r.user_id as string))
      )
    );
    return [...new Set(results.flat())];
  }

  async function send() {
    if (!message.trim()) { setError("Enter a message."); return; }
    setSending(true);
    setError("");

    const targetIds = await getTargetIds();
    const uniqueIds = [...new Set(targetIds)];
    if (uniqueIds.length === 0) { setError("No recipients found."); setSending(false); return; }

    // If editing, close old call first
    if (editingCall) {
      await fetch("/api/delete-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingCall.broadcast_id ? { broadcast_id: editingCall.broadcast_id } : { id: editingCall.id }),
      });
    }

    const broadcast_id = crypto.randomUUID();
    const title = message.trim().split("\n")[0].slice(0, 120);
    const body = message.trim().includes("\n") ? message.trim().split("\n").slice(1).join("\n").trim() || null : null;

    const rows = uniqueIds.map((uid: string) => ({
      user_id: uid,
      sender_id: profile?.id,
      broadcast_id,
      channel: "app",
      notification_type: "broadcast",
      title,
      body,
      location: stagingLink.trim() || null,
      priority: "critical",
      status: "sent",
      sender_name: profile?.full_name ?? profile?.call_sign ?? null,
      sender_unit: profile?.teams[0] ?? null,
    }));

    const { error: insertErr } = await supabase.from("notification_logs").insert(rows);
    if (insertErr) { setError(`Send failed: ${insertErr.message}`); setSending(false); return; }

    await Promise.all(
      uniqueIds.map((user_id: string) =>
        fetch("/api/send-push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id, title, body: body ?? undefined, url: "/",
            critical: true,
            location: stagingLink.trim() || undefined,
            sms: true,
            sender_name: profile?.full_name ?? profile?.call_sign ?? undefined,
            sender_unit: profile?.teams[0] ?? undefined,
          }),
        }).catch(() => null)
      )
    );

    setSending(false);
    onSent();
  }

  const groupLabel = selectedGroups.size === 0 ? "Alert Group"
    : selectedGroups.has("ALL") ? "ALL"
    : [...selectedGroups].join(", ");

  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      <AppHeader profile={profile} profileOpen={false} onProfileClick={() => {}} onSignOut={() => {}} />

      <div className="flex flex-1 flex-col px-5 pt-2 pb-8 gap-4">
        {/* Alert Group dropdown */}
        <div className="relative">
          <button
            onClick={() => setGroupOpen(v => !v)}
            className={`w-full flex items-center justify-between rounded-full px-6 py-4 text-base font-bold text-black transition ${groupOpen ? "bg-[#E94E1B]" : "bg-zinc-600"}`}
          >
            <span>{groupLabel}</span>
            <span className="text-lg">{groupOpen ? "∧" : "∨"}</span>
          </button>

          {groupOpen && (
            <div className="absolute left-0 right-0 top-full z-50 rounded-2xl bg-zinc-600 overflow-hidden border border-zinc-500 shadow-xl">
              {ALL_GROUPS.map((g, i) => (
                <button
                  key={g}
                  onClick={() => toggleGroup(g)}
                  className={`flex w-full items-center justify-between px-6 py-3.5 text-sm font-bold text-black transition hover:bg-zinc-500 ${i < ALL_GROUPS.length - 1 ? "border-b border-zinc-500" : ""}`}
                >
                  <span>{g}</span>
                  <span className={`h-5 w-5 rounded-sm border-2 flex items-center justify-center transition ${selectedGroups.has(g) ? "bg-[#E94E1B] border-[#E94E1B]" : "border-zinc-400 bg-transparent"}`}>
                    {selectedGroups.has(g) && (
                      <svg viewBox="0 0 10 8" className="w-3 h-3 fill-none stroke-white stroke-2"><polyline points="1,4 4,7 9,1" /></svg>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Message textarea */}
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type Message"
          rows={8}
          className="w-full flex-1 rounded-3xl bg-zinc-600 px-5 py-4 text-base text-black placeholder-zinc-800 outline-none resize-none"
        />

        {/* Staging Link */}
        <input
          value={stagingLink}
          onChange={(e) => setStagingLink(e.target.value)}
          placeholder="Staging Link"
          className="w-full rounded-full bg-zinc-600 px-6 py-4 text-base text-black placeholder-zinc-800 outline-none"
        />

        {error && <p className="text-sm text-red-400 px-2">{error}</p>}

        {/* Send Alert */}
        <div className="mt-auto pt-2">
          <button
            onClick={() => void send()}
            disabled={sending}
            className="w-full rounded-full bg-red-600 py-5 text-xl font-black text-black transition active:bg-red-500 disabled:opacity-50"
          >
            {sending ? "SENDING…" : "SEND ALERT"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CriticalAlertPopup({ notif, onDismiss }: { notif: Notif; onDismiss: () => void }) {
  useEffect(() => {
    if (navigator.vibrate) navigator.vibrate([500, 100, 500, 100, 500]);
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90">
      <div className="w-full max-w-sm rounded-3xl bg-red-600 p-6 shadow-2xl text-white">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">🚨</span>
          <div>
            <div className="text-xs font-bold uppercase tracking-widest opacity-80">Critical Alert</div>
            <div className="text-xl font-bold leading-tight">{notif.title}</div>
          </div>
        </div>
        {notif.body && <p className="text-sm opacity-90 mb-3 leading-relaxed">{notif.body}</p>}
        {notif.location && (
          <p className="text-sm opacity-80 mb-2 flex items-center gap-1.5">
            <span>📍</span><span>{notif.location}</span>
          </p>
        )}
        {(notif.sender_name || notif.sender_unit) && (
          <p className="text-xs opacity-70 mb-4">
            Sent by: {[notif.sender_name, notif.sender_unit].filter(Boolean).join(" · ")}
          </p>
        )}
        <button
          onClick={onDismiss}
          className="w-full rounded-xl bg-white/25 hover:bg-white/35 py-3 font-bold text-white transition"
        >
          Acknowledge
        </button>
      </div>
    </div>
  );
}
