"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentTestEmail, getStoredRole } from "@/lib/dev-user";

type Profile = {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  call_sign: string | null;
  home_address: string | null;
  car_make: string | null;
  car_model: string | null;
  car_color: string | null;
  license_plate_state: string | null;
  license_plate_number: string | null;
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

// ─── Pull-to-refresh ────────────────────────────────────────────────────────

function PullToRefresh({ onRefresh }: { onRefresh: () => void }) {
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const THRESHOLD = 70;

  function onTouchStart(e: React.TouchEvent) { startY.current = e.touches[0].clientY; }
  function onTouchMove(e: React.TouchEvent) {
    if (window.scrollY > 0) return;
    setPulling(e.touches[0].clientY - startY.current > 20);
  }
  async function onTouchEnd(e: React.TouchEvent) {
    const dy = e.changedTouches[0].clientY - startY.current;
    setPulling(false);
    if (dy >= THRESHOLD && window.scrollY === 0) {
      setRefreshing(true);
      onRefresh();
      await new Promise(r => setTimeout(r, 800));
      setRefreshing(false);
    }
  }

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
      className="absolute inset-x-0 top-16 flex justify-center pointer-events-none z-10">
      {(pulling || refreshing) && (
        <div className={`mt-2 flex items-center gap-2 rounded-full bg-zinc-800 px-4 py-1.5 text-xs text-zinc-400 shadow-lg pointer-events-none ${refreshing ? "opacity-100" : "opacity-70"}`}>
          <div className={`h-3.5 w-3.5 rounded-full border-2 border-zinc-700 border-t-[#E94E1B] ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing…" : "Release to refresh"}
        </div>
      )}
    </div>
  );
}

// ─── Header ─────────────────────────────────────────────────────────────────

function AppHeader({ profile, onProfileClick }: { profile: Profile | null; onProfileClick: () => void }) {
  return (
    <div className="sticky top-0 z-20 flex items-center justify-between bg-black px-4 pt-12 pb-3 border-b border-zinc-900">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/matzil-words.avif" alt="Matzil Search & Rescue" className="h-9 object-contain" />
      <button
        onClick={onProfileClick}
        className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#E94E1B] text-[#E94E1B] transition active:opacity-60"
        aria-label="Account"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
          <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
        </svg>
      </button>
    </div>
  );
}

// ─── Shell ───────────────────────────────────────────────────────────────────

export default function V1Shell() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notifications, setNotifications] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [accountOpen, setAccountOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [editingCall, setEditingCall] = useState<Notif | null>(null);
  const [criticalAlert, setCriticalAlert] = useState<Notif | null>(null);
  const role = getStoredRole();
  const isAdmin = ADMIN_ROLES.includes(role);

  useEffect(() => { void init(); }, []);

  // Show in-app popup when app opened from a background FCM notification
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
    const filter = isAdmin ? undefined : `user_id=eq.${uid}`;
    const channel = supabase
      .channel("v1-notifs")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notification_logs", ...(filter ? { filter } : {}) },
        (payload) => {
          const n = payload.new as Notif;
          if (n.priority === "critical") setCriticalAlert({ ...n, sender_name: null, sender_unit: null });
          void loadNotifications(uid, isAdmin);
        }
      )
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "notification_logs", ...(filter ? { filter } : {}) },
        () => void loadNotifications(uid, isAdmin)
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.id, isAdmin]);

  async function init() {
    const email = getCurrentTestEmail();
    const { data: user } = await supabase
      .from("users")
      .select(`id, full_name, email, phone, call_sign,
        home_address, car_make, car_model, car_color,
        license_plate_state, license_plate_number,
        user_units ( units ( name ) )`)
      .eq("email", email)
      .single();

    if (user) {
      const teams = ((user as any).user_units ?? [])
        .flatMap((uu: any) => {
          const u = uu.units;
          return Array.isArray(u) ? u.map((x: any) => x.name) : u?.name ? [u.name] : [];
        });
      setProfile({ ...(user as any), teams });
      await loadNotifications((user as any).id, ADMIN_ROLES.includes(getStoredRole()));
    }
    setLoading(false);
  }

  async function loadNotifications(uid: string, adminLoad = false) {
    let query = supabase
      .from("notification_logs")
      .select("id,broadcast_id,title,body,location,priority,created_at,sender_id,sender_name,sender_unit")
      .order("created_at", { ascending: false })
      .limit(200);

    if (!adminLoad) query = query.eq("user_id", uid);

    const { data } = await query;

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
        .from("users").select("id,full_name,call_sign,user_units(units(name))")
        .in("id", [...new Set(needsLookup.map(n => n.sender_id!))]);
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
    setNotifications(deduped);
  }

  function fmt(d: string) {
    return new Date(d).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  async function deleteNotif(n: Notif) {
    const res = await fetch("/api/delete-notification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(n.broadcast_id ? { broadcast_id: n.broadcast_id } : { id: n.id }),
    });
    if (!res.ok) return;
    setNotifications(prev => prev.filter(x => n.broadcast_id ? x.broadcast_id !== n.broadcast_id : x.id !== n.id));
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-800 border-t-[#E94E1B]" />
      </div>
    );
  }

  const activeCall = notifications[0] ?? null;

  return (
    <div className="relative min-h-screen bg-black text-zinc-50">
      <AppHeader profile={profile} onProfileClick={() => setAccountOpen(true)} />

      <PullToRefresh onRefresh={() => profile?.id ? void loadNotifications(profile.id, isAdmin) : undefined} />

      {/* Feed */}
      <div className="mx-auto max-w-lg px-4 py-4 space-y-3 pb-40">
        {notifications.length === 0 ? (
          <div className="flex justify-center pt-6">
            <span className="rounded-full bg-zinc-700 px-8 py-3 text-sm font-bold text-zinc-400 tracking-wider">
              NO CALLS
            </span>
          </div>
        ) : (
          notifications.map((n, i) => (
            <NotifCard
              key={n.id}
              notif={n}
              isActive={i === 0}
              isAdmin={isAdmin}
              isGlobalAdmin={role === "Global Admin"}
              adminId={profile?.id ?? null}
              fmt={fmt}
              onDelete={() => void deleteNotif(n)}
              onEdit={() => { setEditingCall(n); setComposeOpen(true); }}
              onUpdate={(updated) => setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, ...updated } : x))}
            />
          ))
        )}
      </div>

      {/* Admin bottom action bar */}
      {isAdmin && (
        <div className="fixed bottom-0 inset-x-0 px-4 pb-8 pt-3 bg-gradient-to-t from-black via-black/90 to-transparent space-y-3 z-10">
          {activeCall && (
            <div className="flex gap-3">
              <button
                onClick={() => { setEditingCall(activeCall); setComposeOpen(true); }}
                className="flex-1 rounded-full bg-zinc-700 py-3.5 text-sm font-bold text-zinc-300 transition active:bg-zinc-600">
                EDIT CALL
              </button>
              <button
                onClick={() => void deleteNotif(activeCall)}
                className="flex-1 rounded-full bg-green-600 py-3.5 text-sm font-black text-black transition active:bg-green-500">
                CLOSE CALL
              </button>
            </div>
          )}
          <button
            onClick={() => { setEditingCall(null); setComposeOpen(true); }}
            className="w-full rounded-full bg-red-600 py-5 text-xl font-black text-black transition active:bg-red-500">
            {activeCall ? "NEW ALERT" : "SEND ALERT"}
          </button>
        </div>
      )}

      {/* Overlays */}
      {criticalAlert && <CriticalAlertPopup notif={criticalAlert} onDismiss={() => setCriticalAlert(null)} />}
      {accountOpen && <AccountPanel profile={profile} isAdmin={isAdmin} onClose={() => setAccountOpen(false)} />}
      {isAdmin && composeOpen && (
        <ComposeScreen
          senderId={profile?.id ?? null}
          senderName={profile?.full_name ?? profile?.call_sign ?? null}
          senderUnit={profile?.teams[0] ?? null}
          editingCall={editingCall}
          onClose={() => { setComposeOpen(false); setEditingCall(null); }}
          onSent={() => {
            setComposeOpen(false);
            setEditingCall(null);
            if (profile?.id) void loadNotifications(profile.id, isAdmin);
          }}
        />
      )}
    </div>
  );
}

// ─── Critical alert popup ────────────────────────────────────────────────────

function CriticalAlertPopup({ notif, onDismiss }: { notif: Notif; onDismiss: () => void }) {
  useEffect(() => {
    if (navigator.vibrate) navigator.vibrate([500, 100, 500, 100, 500]);
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
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
          <p className="text-sm opacity-80 mb-2 flex items-center gap-1.5"><span>📍</span><span>{notif.location}</span></p>
        )}
        {(notif.sender_name || notif.sender_unit) && (
          <p className="text-xs opacity-70 mb-4">Sent by: {[notif.sender_name, notif.sender_unit].filter(Boolean).join(" · ")}</p>
        )}
        <button onClick={onDismiss}
          className="w-full rounded-xl bg-white/25 hover:bg-white/35 active:bg-white/40 py-3 font-bold text-white transition">
          Acknowledge
        </button>
      </div>
    </div>
  );
}

// ─── Notification card ───────────────────────────────────────────────────────

function NotifCard({ notif, isActive, isAdmin, isGlobalAdmin, adminId, fmt, onDelete, onEdit, onUpdate }: {
  notif: Notif;
  isActive: boolean;
  isAdmin: boolean;
  isGlobalAdmin: boolean;
  adminId: string | null;
  fmt: (d: string) => string;
  onDelete: () => void;
  onEdit: () => void;
  onUpdate: (patch: Partial<Notif>) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const canEdit = isAdmin && notif.sender_id === adminId;
  const canDelete = canEdit || isGlobalAdmin;

  function openMaps() {
    if (!notif.location) return;
    const url = notif.location.startsWith("http")
      ? notif.location
      : `https://maps.google.com/?q=${encodeURIComponent(notif.location)}`;
    window.open(url, "_blank");
  }

  // Active call gets a larger prominent display; history cards are compact
  if (isActive) {
    return (
      <div className="rounded-3xl bg-zinc-700 p-5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-zinc-400 font-medium mb-1">Call Message</p>
            <p className="text-base font-bold text-white leading-snug">{notif.title}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {canEdit && !confirmDelete && (
              <button onClick={onEdit} className="rounded-md p-1.5 hover:bg-white/10 transition" aria-label="Edit">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-zinc-400">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            )}
            {canDelete && (
              confirmDelete ? (
                <>
                  <button onClick={() => { onDelete(); setConfirmDelete(false); }}
                    className="rounded-md px-2.5 py-1 text-xs font-semibold bg-red-600/80 text-white transition">Confirm</button>
                  <button onClick={() => setConfirmDelete(false)}
                    className="rounded-md px-2.5 py-1 text-xs bg-zinc-600 text-zinc-300 transition">Cancel</button>
                </>
              ) : (
                <button onClick={() => setConfirmDelete(true)} className="rounded-md p-1.5 hover:bg-white/10 transition" aria-label="Delete">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-zinc-400">
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                  </svg>
                </button>
              )
            )}
            <span className="text-xs text-zinc-500 ml-1">{fmt(notif.created_at)}</span>
          </div>
        </div>
        {notif.body && <p className="text-sm text-zinc-300 leading-relaxed">{notif.body}</p>}
        {(notif.sender_name || notif.sender_unit) && (
          <p className="text-xs text-zinc-500">👤 {[notif.sender_name, notif.sender_unit].filter(Boolean).join(" · ")}</p>
        )}
        {notif.location && (
          <button onClick={openMaps}
            className="w-full rounded-full bg-zinc-600 py-3 text-sm font-bold text-black transition active:bg-zinc-500">
            Open Maps
          </button>
        )}
      </div>
    );
  }

  // History card — compact
  return (
    <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold text-sm text-zinc-200 leading-snug flex-1 min-w-0">{notif.title}</span>
        <div className="flex items-center gap-1 shrink-0">
          {canEdit && !confirmDelete && (
            <button onClick={onEdit} className="rounded-md p-1.5 hover:bg-zinc-800 transition" aria-label="Edit">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 text-zinc-500">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          )}
          {canDelete && (
            confirmDelete ? (
              <>
                <button onClick={() => { onDelete(); setConfirmDelete(false); }}
                  className="rounded px-2 py-0.5 text-xs font-semibold bg-red-700 text-white">Confirm</button>
                <button onClick={() => setConfirmDelete(false)}
                  className="rounded px-2 py-0.5 text-xs bg-zinc-800 text-zinc-400">Cancel</button>
              </>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="rounded-md p-1.5 hover:bg-zinc-800 transition" aria-label="Delete">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 text-zinc-500">
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                </svg>
              </button>
            )
          )}
          <span className="text-xs text-zinc-600 ml-1">{fmt(notif.created_at)}</span>
        </div>
      </div>
      {notif.body && <p className="text-xs text-zinc-500 leading-relaxed">{notif.body}</p>}
      {notif.location && (
        <p className="text-xs text-zinc-600 flex items-center gap-1 cursor-pointer hover:text-zinc-400"
          onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(notif.location!)}`, "_blank")}>
          <span>📍</span><span>{notif.location}</span>
        </p>
      )}
      {(notif.sender_name || notif.sender_unit) && (
        <p className="text-xs text-zinc-600">👤 {[notif.sender_name, notif.sender_unit].filter(Boolean).join(" · ")}</p>
      )}
    </div>
  );
}

// ─── PushSetupRow ────────────────────────────────────────────────────────────

function PushSetupRow() {
  const [status, setStatus] = useState<"idle" | "busy" | "ok" | "error">("idle");
  const [detail, setDetail] = useState("");
  const [isNative, setIsNative] = useState(false);
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    import("@capacitor/core").then(({ Capacitor }) => {
      if (!Capacitor.isNativePlatform()) return;
      setIsNative(true);
      if (localStorage.getItem("fcm-registered") === "1") setRegistered(true);
    });
  }, []);

  if (!isNative || registered) return null;

  async function setup() {
    setStatus("busy"); setDetail("");
    try {
      const { Capacitor } = await import("@capacitor/core");
      const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");
      const perm = await FirebaseMessaging.requestPermissions();
      if (perm.receive !== "granted") { setDetail("Permission: " + perm.receive); setStatus("error"); return; }
      const { token } = await FirebaseMessaging.getToken();
      if (!token) { setDetail("No token returned"); setStatus("error"); return; }
      const { data: authData } = await supabase.auth.getUser();
      const email = authData.user?.email;
      if (!email) { setDetail("Not logged in"); setStatus("error"); return; }
      const { data: user } = await supabase.from("users").select("id").ilike("email", email).maybeSingle();
      if (!user?.id) { setDetail("User not found: " + email); setStatus("error"); return; }
      const { error } = await supabase.from("fcm_tokens").upsert(
        { user_id: user.id, token, platform: Capacitor.getPlatform() },
        { onConflict: "user_id,platform" }
      );
      if (error) { setDetail("DB error: " + error.message); setStatus("error"); return; }
      localStorage.setItem("fcm-registered", "1");
      setDetail(`Token saved ✓  uid=${user.id.slice(0, 8)}…`);
      setStatus("ok");
      setTimeout(() => setRegistered(true), 1500);
    } catch (e: any) { setDetail(e?.message ?? String(e)); setStatus("error"); }
  }

  return (
    <button onClick={() => void setup()} disabled={status === "busy"}
      className={`w-full rounded-xl px-4 py-3 text-sm font-medium text-left transition ${
        status === "ok" ? "bg-green-900/40 text-green-300" :
        status === "error" ? "bg-red-900/40 text-red-300" :
        "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"}`}>
      {status === "busy" ? "Registering…" : status === "ok" ? "Push notifications active ✓" : "Set up push notifications"}
      {detail && <div className="mt-0.5 text-xs opacity-70 break-all">{detail}</div>}
    </button>
  );
}

// ─── Account panel ───────────────────────────────────────────────────────────

function AccountPanel({ profile, isAdmin, onClose }: { profile: Profile | null; isAdmin: boolean; onClose: () => void }) {
  const [resetSent, setResetSent] = useState(false);

  async function resetPassword() {
    if (!profile?.email) return;
    await supabase.auth.resetPasswordForEmail(profile.email, { redirectTo: `${window.location.origin}/auth/callback?type=recovery` });
    setResetSent(true);
  }

  async function logout() {
    localStorage.removeItem("auth-email");
    localStorage.removeItem("real-role");
    localStorage.removeItem("dev-role");
    localStorage.removeItem("session-temporary");
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 flex h-full w-full max-w-sm flex-col overflow-y-auto bg-zinc-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <h2 className="font-semibold text-zinc-50">Account</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-lg leading-none">✕</button>
        </div>
        {profile && (
          <div className="flex-1 p-5 space-y-5">
            <div>
              <div className="text-xl font-bold text-zinc-50">{profile.full_name ?? "—"}</div>
              {profile.call_sign && <div className="text-sm font-mono font-semibold text-[#E94E1B] mt-0.5">{profile.call_sign}</div>}
            </div>
            <div className="space-y-3">
              <InfoRow label="Email" value={profile.email} />
              <InfoRow label="Phone" value={profile.phone} />
              <InfoRow label="Home Address" value={profile.home_address} />
              {profile.teams.length > 0 && <InfoRow label="Assigned Teams" value={profile.teams.join(", ")} />}
            </div>
            {(profile.car_make || profile.car_model || profile.car_color || profile.license_plate_number) && (
              <div className="rounded-xl bg-zinc-800 p-4 space-y-1.5">
                <div className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Vehicle</div>
                <div className="text-sm text-zinc-100">{[profile.car_color, profile.car_make, profile.car_model].filter(Boolean).join(" ") || "—"}</div>
                {profile.license_plate_number && (
                  <div className="text-sm text-zinc-400">{[profile.license_plate_state, profile.license_plate_number].filter(Boolean).join(" · ")}</div>
                )}
              </div>
            )}
            <div className="space-y-2 pt-2 border-t border-zinc-800">
              <PushSetupRow />
              <button onClick={() => void resetPassword()} disabled={resetSent}
                className="w-full rounded-xl bg-zinc-800 px-4 py-3 text-sm font-medium text-zinc-200 hover:bg-zinc-700 transition text-left">
                {resetSent ? "Reset email sent ✓" : "Reset Password"}
              </button>
              {isAdmin && (
                <button onClick={() => { sessionStorage.setItem("v2-mode", "1"); window.location.reload(); }}
                  className="w-full rounded-xl bg-zinc-800 px-4 py-3 text-sm font-medium text-[#E94E1B] hover:bg-zinc-700 transition text-left">
                  Switch to V2 →
                </button>
              )}
              <button onClick={() => void logout()}
                className="w-full rounded-xl bg-zinc-800 px-4 py-3 text-sm font-medium text-red-400 hover:bg-zinc-700 transition text-left">
                Log Out
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-sm text-zinc-200">{value || "—"}</div>
    </div>
  );
}

// ─── Address autocomplete ────────────────────────────────────────────────────

type NominatimResult = { display_name: string; place_id: number };

function AddressSearch({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleInput(v: string) {
    setQuery(v);
    onChange(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (v.length < 3) { setSuggestions([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(v)}&limit=5&countrycodes=ca,us`,
          { headers: { "Accept-Language": "en" } }
        );
        const data: NominatimResult[] = await res.json();
        setSuggestions(data);
        setOpen(data.length > 0);
      } catch { /* ignore */ }
    }, 350);
  }

  function pick(display: string) {
    setQuery(display);
    onChange(display);
    setSuggestions([]);
    setOpen(false);
  }

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => handleInput(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder ?? "Staging Link / Location (optional)"}
        className="w-full rounded-full bg-zinc-600 px-6 py-4 text-base text-black placeholder-zinc-800 outline-none"
      />
      {open && (
        <ul className="absolute z-50 mt-1 w-full rounded-2xl border border-zinc-700 bg-zinc-900 shadow-xl overflow-hidden">
          {suggestions.map((s) => (
            <li key={s.place_id}
              onMouseDown={() => pick(s.display_name)}
              className="px-4 py-3 text-sm text-zinc-200 hover:bg-zinc-800 cursor-pointer border-b border-zinc-800 last:border-0 leading-snug">
              {s.display_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Compose screen ──────────────────────────────────────────────────────────

function ComposeScreen({ senderId, senderName, senderUnit, editingCall, onClose, onSent }: {
  senderId: string | null;
  senderName: string | null;
  senderUnit: string | null;
  editingCall: Notif | null;
  onClose: () => void;
  onSent: () => void;
}) {
  const [groupOpen, setGroupOpen] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<Set<AlertGroup>>(new Set(["ALL"]));
  const [useCustom, setUseCustom] = useState(false);
  const [members, setMembers] = useState<{ id: string; full_name: string | null; call_sign: string | null }[]>([]);
  const [customIds, setCustomIds] = useState<Set<string>>(new Set());
  const [memberSearch, setMemberSearch] = useState("");
  const [title, setTitle] = useState(editingCall?.title ?? "");
  const [body, setBody] = useState(editingCall?.body ?? "");
  const [location, setLocation] = useState(editingCall?.location ?? "");
  const [triggerSms, setTriggerSms] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [diagnostic, setDiagnostic] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (useCustom) {
      supabase.from("users").select("id,full_name,call_sign").order("call_sign")
        .then(({ data }) => setMembers((data ?? []) as any));
    }
  }, [useCustom]);

  function toggleGroup(g: AlertGroup) {
    if (g === "ALL") {
      setSelectedGroups(prev => prev.has("ALL") && prev.size === 1 ? new Set() : new Set(["ALL"] as AlertGroup[]));
    } else {
      setUseCustom(false);
      setSelectedGroups(prev => {
        const next = new Set(prev);
        next.delete("ALL");
        next.has(g) ? next.delete(g) : next.add(g);
        return next;
      });
    }
  }

  function toggleCustom() {
    setUseCustom(v => !v);
    if (!useCustom) setSelectedGroups(new Set());
  }

  async function getTargetIds(): Promise<string[]> {
    if (useCustom) return [...customIds];
    const groups = [...selectedGroups];
    if (groups.length === 0 || groups.includes("ALL")) {
      const { data } = await supabase.from("users").select("id");
      return (data ?? []).map((r: any) => r.id);
    }
    const results = await Promise.all(
      groups.map(g =>
        supabase.from("user_units").select("user_id, units!inner(name)").ilike("units.name", g)
          .then(({ data }) => (data ?? []).map((r: any) => r.user_id as string))
      )
    );
    return [...new Set(results.flat())];
  }

  async function send() {
    if (!title.trim()) { setErrorMsg("Enter a title."); return; }
    if (useCustom && customIds.size === 0) { setErrorMsg("Select at least one member."); return; }
    setSending(true); setErrorMsg(""); setDiagnostic("");

    const targetIds = await getTargetIds();
    const uniqueIds = [...new Set(targetIds)];
    if (uniqueIds.length === 0) { setErrorMsg("No recipients found."); setSending(false); return; }

    // If editing, close old call first
    if (editingCall) {
      await fetch("/api/delete-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingCall.broadcast_id ? { broadcast_id: editingCall.broadcast_id } : { id: editingCall.id }),
      });
    }

    const broadcast_id = crypto.randomUUID();
    const rows = uniqueIds.map((uid: string) => ({
      user_id: uid, sender_id: senderId, broadcast_id,
      channel: "app", notification_type: "broadcast",
      title: title.trim(), body: body.trim() || null,
      location: location.trim() || null, priority: "critical", status: "sent",
      sender_name: senderName ?? null, sender_unit: senderUnit ?? null,
    }));

    const { error: insertErr } = await supabase.from("notification_logs").insert(rows);
    if (insertErr) { setErrorMsg(`Send failed: ${insertErr.message}`); setSending(false); return; }

    const pushResults = await Promise.all(
      uniqueIds.map((user_id: string) =>
        fetch("/api/send-push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id, title: title.trim(), body: body.trim() || undefined,
            url: "/", critical: true, location: location.trim() || undefined,
            sms: triggerSms, sender_name: senderName ?? undefined, sender_unit: senderUnit ?? undefined,
          }),
        }).then(r => r.json()).catch((e: any) => ({ error: e?.message }))
      )
    );
    const totalFcm = pushResults.reduce((s: number, r: any) => s + (r?.fcm ?? 0), 0);
    const totalSms = pushResults.reduce((s: number, r: any) => s + (r?.sms ? 1 : 0), 0);
    const pushErrors = pushResults.flatMap((r: any) => r?.errors ?? []);
    const fcmConfigured = pushResults.some((r: any) => r?.fcmConfigured);
    const fcmTokensFound = pushResults.reduce((s: number, r: any) => s + (r?.fcmTokensFound ?? 0), 0);
    const parts = [`${uniqueIds.length} recipients`, fcmConfigured ? `FCM: ${totalFcm} sent (${fcmTokensFound} tokens)` : "FCM: not configured", `SMS: ${totalSms}`];
    if (pushErrors.length) parts.push(`errors: ${[...new Set(pushErrors)].join("; ")}`);
    setDiagnostic(parts.join(" · "));

    setSending(false);
    setSent(true);
    onSent();
  }

  const groupLabel = useCustom ? "CUSTOM" : selectedGroups.size === 0 ? "Alert Group" : selectedGroups.has("ALL") ? "ALL" : [...selectedGroups].join(", ");
  const filteredMembers = memberSearch.trim()
    ? members.filter(m => [m.full_name, m.call_sign].join(" ").toLowerCase().includes(memberSearch.toLowerCase()))
    : members;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-12 pb-3 border-b border-zinc-900 shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/matzil-words.avif" alt="Matzil Search & Rescue" className="h-9 object-contain" />
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-2xl leading-none px-2">✕</button>
      </div>

      <div className="flex-1 px-5 pt-4 pb-10 space-y-4">
        {/* Alert Group dropdown */}
        <div className="relative">
          <button
            onClick={() => setGroupOpen(v => !v)}
            className={`w-full flex items-center justify-between rounded-full px-6 py-4 text-base font-bold text-black transition ${groupOpen || useCustom ? "bg-[#E94E1B]" : "bg-zinc-600"}`}
          >
            <span>{groupLabel}</span>
            <span>{groupOpen ? "∧" : "∨"}</span>
          </button>

          {groupOpen && (
            <div className="absolute left-0 right-0 top-full z-50 rounded-2xl bg-zinc-600 overflow-hidden shadow-xl mt-1">
              {ALL_GROUPS.map((g, i) => (
                <button key={g} onClick={() => toggleGroup(g)}
                  className={`flex w-full items-center justify-between px-6 py-3.5 text-sm font-bold text-black transition hover:bg-zinc-500 ${i < ALL_GROUPS.length - 1 ? "border-b border-zinc-500" : ""}`}>
                  <span>{g}</span>
                  <span className={`h-5 w-5 rounded-sm border-2 flex items-center justify-center transition ${selectedGroups.has(g) ? "bg-[#E94E1B] border-[#E94E1B]" : "border-zinc-400 bg-transparent"}`}>
                    {selectedGroups.has(g) && <svg viewBox="0 0 10 8" className="w-3 h-3 fill-none stroke-white stroke-2"><polyline points="1,4 4,7 9,1" /></svg>}
                  </span>
                </button>
              ))}
              {/* Custom group */}
              <button onClick={() => { toggleCustom(); setGroupOpen(false); }}
                className={`flex w-full items-center justify-between px-6 py-3.5 text-sm font-bold text-black transition hover:bg-zinc-500 border-t border-zinc-500`}>
                <span>CUSTOM</span>
                <span className={`h-5 w-5 rounded-sm border-2 flex items-center justify-center transition ${useCustom ? "bg-[#E94E1B] border-[#E94E1B]" : "border-zinc-400 bg-transparent"}`}>
                  {useCustom && <svg viewBox="0 0 10 8" className="w-3 h-3 fill-none stroke-white stroke-2"><polyline points="1,4 4,7 9,1" /></svg>}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Custom member picker */}
        {useCustom && (
          <div className="space-y-2">
            <input value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} placeholder="Search members…"
              className="w-full rounded-full bg-zinc-600 px-6 py-3 text-sm text-black placeholder-zinc-800 outline-none" />
            <div className="max-h-44 overflow-y-auto rounded-2xl border border-zinc-800 divide-y divide-zinc-800 bg-zinc-900">
              {filteredMembers.map(m => (
                <button key={m.id} onClick={() => setCustomIds(prev => { const n = new Set(prev); n.has(m.id) ? n.delete(m.id) : n.add(m.id); return n; })}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-zinc-800 transition">
                  <span className={`h-4 w-4 rounded border-2 shrink-0 ${customIds.has(m.id) ? "bg-[#E94E1B] border-[#E94E1B]" : "border-zinc-600"}`} />
                  <span className="font-mono text-sm text-zinc-100">{m.call_sign ?? "—"}</span>
                  <span className="text-sm text-zinc-400">{m.full_name}</span>
                </button>
              ))}
            </div>
            {customIds.size > 0 && <div className="text-xs text-zinc-500 px-1">{customIds.size} selected</div>}
          </div>
        )}

        {/* Title */}
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Alert Title *"
          className="w-full rounded-full bg-zinc-600 px-6 py-4 text-base text-black placeholder-zinc-800 outline-none" />

        {/* Message textarea */}
        <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Type Message (optional details)"
          rows={5}
          className="w-full rounded-3xl bg-zinc-600 px-5 py-4 text-base text-black placeholder-zinc-800 outline-none resize-none" />

        {/* Staging / Location */}
        <AddressSearch value={location} onChange={setLocation} placeholder="Staging Link / Location (optional)" />

        {/* SMS toggle */}
        <label className="flex items-center gap-3 cursor-pointer select-none px-1">
          <div onClick={() => setTriggerSms(v => !v)}
            className={`w-5 h-5 rounded flex items-center justify-center border-2 transition ${triggerSms ? "bg-[#E94E1B] border-[#E94E1B]" : "border-zinc-600 bg-transparent"}`}>
            {triggerSms && <svg viewBox="0 0 10 8" className="w-3 h-3 text-white fill-none stroke-current stroke-2"><polyline points="1,4 4,7 9,1" /></svg>}
          </div>
          <span className="text-sm font-medium text-zinc-300">Trigger SMS</span>
        </label>

        {errorMsg && <p className="rounded-2xl border border-red-700/50 bg-red-900/40 px-4 py-3 text-sm text-red-300">{errorMsg}</p>}

        {/* Send button */}
        <button onClick={() => void send()} disabled={sending || !title.trim() || sent}
          className="w-full rounded-full bg-red-600 py-5 text-xl font-black text-black transition active:bg-red-500 disabled:opacity-50">
          {sent ? "SENT ✓" : sending ? "SENDING…" : "SEND ALERT"}
        </button>

        {/* Diagnostic */}
        {diagnostic && (
          <div className="rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-400">
            <div className="font-semibold text-green-400 mb-1">Notification sent</div>
            {diagnostic}
          </div>
        )}
      </div>
    </div>
  );
}
