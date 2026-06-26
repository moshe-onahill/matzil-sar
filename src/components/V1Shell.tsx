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
};

const ADMIN_ROLES = ["Dispatcher", "SAR Manager", "Global Admin"];

export default function V1Shell() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notifications, setNotifications] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [accountOpen, setAccountOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [criticalAlert, setCriticalAlert] = useState<Notif | null>(null);
  const role = getStoredRole();
  const isAdmin = ADMIN_ROLES.includes(role);

  useEffect(() => { void init(); }, []);

  useEffect(() => {
    if (!profile?.id) return;
    const uid = profile.id;
    const channel = supabase
      .channel("v1-notifs")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notification_logs", filter: `user_id=eq.${uid}` },
        (payload) => {
          const n = payload.new as Notif;
          if (n.priority === "critical") setCriticalAlert(n);
          void loadNotifications(uid);
        }
      )
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "notification_logs", filter: `user_id=eq.${uid}` },
        () => void loadNotifications(uid)
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.id]);

  async function init() {
    const email = getCurrentTestEmail();

    const { data: user } = await supabase
      .from("users")
      .select(`
        id, full_name, email, phone, call_sign,
        home_address, car_make, car_model, car_color,
        license_plate_state, license_plate_number,
        user_units ( units ( name ) )
      `)
      .eq("email", email)
      .single();

    if (user) {
      const teams = ((user as any).user_units ?? [])
        .flatMap((uu: any) => {
          const u = uu.units;
          return Array.isArray(u) ? u.map((x: any) => x.name) : u?.name ? [u.name] : [];
        });
      setProfile({ ...(user as any), teams });
      await loadNotifications((user as any).id);

    }

    setLoading(false);
  }

  async function loadNotifications(uid: string) {
    const { data } = await supabase
      .from("notification_logs")
      .select("id,broadcast_id,title,body,location,priority,created_at,sender_id")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(100);

    // Deduplicate by broadcast_id so admins don't see their own send as a duplicate
    const seen = new Set<string>();
    const deduped: Notif[] = [];
    for (const n of (data ?? []) as Notif[]) {
      const key = n.broadcast_id ?? n.id;
      if (!seen.has(key)) { seen.add(key); deduped.push(n); }
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
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      console.error("Delete failed:", res.status, body);
      return;
    }
    setNotifications((prev) => prev.filter((x) => (n.broadcast_id ? x.broadcast_id !== n.broadcast_id : x.id !== n.id)));
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-800 border-t-[#E94E1B]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      {/* Header */}
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-zinc-900 bg-zinc-950/95 px-4 py-3 backdrop-blur-sm">
        <span className="text-lg font-bold">Matzil SAR</span>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => setComposeOpen(true)}
              className="rounded-lg bg-[#E94E1B] px-3 py-1.5 text-sm font-semibold text-white hover:bg-orange-600 transition"
            >
              Send Notification
            </button>
          )}
          <button
            onClick={() => setAccountOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition"
            aria-label="Account"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Feed */}
      <div className="mx-auto max-w-lg px-4 py-4 space-y-3 pb-8">
        {notifications.length === 0 ? (
          <div className="py-20 text-center text-sm text-zinc-500">No notifications yet.</div>
        ) : (
          notifications.map((n) => (
            <NotifCard
              key={n.id}
              notif={n}
              isAdmin={isAdmin}
              isGlobalAdmin={role === "Global Admin"}
              adminId={profile?.id ?? null}
              fmt={fmt}
              onDelete={() => void deleteNotif(n)}
              onUpdate={(updated) =>
                setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, ...updated } : x))
              }
            />
          ))
        )}
      </div>

      {criticalAlert && (
        <CriticalAlertPopup notif={criticalAlert} onDismiss={() => setCriticalAlert(null)} />
      )}
      {accountOpen && (
        <AccountPanel profile={profile} isAdmin={isAdmin} onClose={() => setAccountOpen(false)} />
      )}
      {isAdmin && composeOpen && (
        <ComposeModal
          onClose={() => setComposeOpen(false)}
          onSent={(n) => setNotifications((prev) => [n, ...prev])}
          senderId={profile?.id ?? null}
          onRefresh={() => profile && void loadNotifications(profile.id)}
        />
      )}
    </div>
  );
}

function CriticalAlertPopup({ notif, onDismiss }: { notif: Notif; onDismiss: () => void }) {
  useEffect(() => {
    // Vibrate on mobile if supported
    if (navigator.vibrate) navigator.vibrate([500, 100, 500, 100, 500]);
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl bg-red-600 p-6 shadow-2xl text-white animate-bounce-in">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">🚨</span>
          <div>
            <div className="text-xs font-bold uppercase tracking-widest opacity-80">Critical Alert</div>
            <div className="text-xl font-bold leading-tight">{notif.title}</div>
          </div>
        </div>
        {notif.body && <p className="text-sm opacity-90 mb-3 leading-relaxed">{notif.body}</p>}
        {notif.location && (
          <p className="text-sm opacity-80 mb-4 flex items-center gap-1.5">
            <span>📍</span><span>{notif.location}</span>
          </p>
        )}
        <button
          onClick={onDismiss}
          className="w-full rounded-xl bg-white/25 hover:bg-white/35 active:bg-white/40 py-3 font-bold text-white transition"
        >
          Acknowledge
        </button>
      </div>
    </div>
  );
}

function NotifCard({
  notif,
  isAdmin,
  isGlobalAdmin,
  adminId,
  fmt,
  onDelete,
  onUpdate,
}: {
  notif: Notif;
  isAdmin: boolean;
  isGlobalAdmin: boolean;
  adminId: string | null;
  fmt: (d: string) => string;
  onDelete: () => void;
  onUpdate: (patch: Partial<Notif>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(notif.title);
  const [body, setBody] = useState(notif.body ?? "");
  const [location, setLocation] = useState(notif.location ?? "");
  const [priority, setPriority] = useState<string>(notif.priority ?? "critical");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const canEdit = isAdmin && notif.sender_id === adminId;
  const canDelete = canEdit || isGlobalAdmin;

  async function save() {
    setSaving(true);
    const patch = {
      title: title.trim(),
      body: body.trim() || null,
      location: location.trim() || null,
      priority,
    };
    if (notif.broadcast_id) {
      await supabase.from("notification_logs").update(patch).eq("broadcast_id", notif.broadcast_id);
    } else {
      await supabase.from("notification_logs").update(patch).eq("id", notif.id);
    }
    setSaving(false);
    setEditing(false);
    onUpdate(patch);
  }

  const bg = priority === "critical" ? "bg-red-600" : "bg-[#E94E1B]";

  if (editing) {
    return (
      <div className={`rounded-2xl p-4 space-y-3 ${bg} text-white`}>
        <div className="flex gap-2">
          <button onClick={() => setPriority("critical")}
            className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${priority === "critical" ? "bg-white/30" : "bg-white/10 hover:bg-white/20"}`}>
            ⚠ Critical
          </button>
        </div>
        <input value={title} onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg bg-white/20 px-3 py-2 text-sm text-white placeholder-white/60 outline-none focus:bg-white/30"
          placeholder="Title" />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2}
          className="w-full rounded-lg bg-white/20 px-3 py-2 text-sm text-white placeholder-white/60 outline-none focus:bg-white/30 resize-none"
          placeholder="Description (optional)" />
        <input value={location} onChange={(e) => setLocation(e.target.value)}
          className="w-full rounded-lg bg-white/20 px-3 py-2 text-sm text-white placeholder-white/60 outline-none focus:bg-white/30"
          placeholder="Location (optional)" />
        <div className="flex gap-2">
          <button onClick={() => void save()} disabled={saving || !title.trim()}
            className="rounded-lg bg-white/30 px-4 py-1.5 text-sm font-semibold hover:bg-white/40 disabled:opacity-50 transition">
            {saving ? "Saving…" : "Save"}
          </button>
          <button onClick={() => setEditing(false)}
            className="rounded-lg bg-white/10 px-4 py-1.5 text-sm hover:bg-white/20 transition">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl p-4 space-y-1.5 ${bg} text-white`}>
      {/* Title + actions row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <span className="font-bold text-base leading-snug">{notif.title}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {canEdit && !confirmDelete && (
            <button onClick={() => setEditing(true)}
              className="rounded-md p-1.5 hover:bg-white/20 transition" aria-label="Edit">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          )}
          {canDelete && (
            confirmDelete ? (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(); setConfirmDelete(false); }}
                  className="rounded-md px-2.5 py-1 text-xs font-semibold bg-white/30 hover:bg-white/50 active:bg-white/60 transition">
                  Confirm
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }}
                  className="rounded-md px-2.5 py-1 text-xs bg-white/10 hover:bg-white/20 transition">
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
                className="rounded-md p-1.5 hover:bg-white/20 transition" aria-label="Delete">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                </svg>
              </button>
            )
          )}
          <span className="text-xs opacity-70 ml-1">{fmt(notif.created_at)}</span>
        </div>
      </div>
      {notif.body && <p className="text-sm opacity-90 leading-relaxed">{notif.body}</p>}
      {notif.location && (
        <p className="text-xs opacity-75 flex items-center gap-1">
          <span>📍</span><span>{notif.location}</span>
        </p>
      )}
    </div>
  );
}

function PushSetupRow() {
  const [status, setStatus] = useState<"idle" | "busy" | "ok" | "error">("idle");
  const [detail, setDetail] = useState("");
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    import("@capacitor/core").then(({ Capacitor }) => setIsNative(Capacitor.isNativePlatform()));
  }, []);

  if (!isNative) return null;

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
      const { data: saved } = await supabase.from("fcm_tokens").select("token").eq("user_id", user.id).maybeSingle();
      if (!saved) { setDetail("Saved but verify failed — check Supabase fcm_tokens table"); setStatus("error"); return; }
      setDetail(`Token saved ✓ (${token.slice(0, 12)}…)`);
      setStatus("ok");
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

const TEAM_GROUPS = ["WATER", "WILDERNESS", "MRU", "SUPPORT"] as const;
type TeamGroup = typeof TEAM_GROUPS[number];

type NominatimResult = { display_name: string; place_id: number };

function AddressSearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
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
        placeholder="Location (optional)"
        className="w-full rounded-xl bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-[#E94E1B] placeholder-zinc-600"
      />
      {open && (
        <ul className="absolute z-50 mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl overflow-hidden">
          {suggestions.map((s) => (
            <li key={s.place_id}
              onMouseDown={() => pick(s.display_name)}
              className="px-3 py-2.5 text-sm text-zinc-200 hover:bg-zinc-800 cursor-pointer border-b border-zinc-800 last:border-0 leading-snug">
              {s.display_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ComposeModal({ onClose, onSent, senderId, onRefresh }: { onClose: () => void; onSent: (n: Notif) => void; senderId: string | null; onRefresh: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [location, setLocation] = useState("");
  const [priority, setPriority] = useState<"routine" | "critical">("critical");
  // selectedGroups: set of team names; empty = ALL; "CUSTOM" uses customIds
  const [selectedGroups, setSelectedGroups] = useState<Set<TeamGroup>>(new Set());
  const [useCustom, setUseCustom] = useState(false);
  const [members, setMembers] = useState<{ id: string; full_name: string | null; call_sign: string | null }[]>([]);
  const [customIds, setCustomIds] = useState<Set<string>>(new Set());
  const [memberSearch, setMemberSearch] = useState("");
  const [triggerSms, setTriggerSms] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (useCustom) {
      supabase.from("users").select("id,full_name,call_sign").order("call_sign")
        .then(({ data }) => setMembers((data ?? []) as any));
    }
  }, [useCustom]);

  function toggleGroup(g: TeamGroup) {
    setUseCustom(false);
    setSelectedGroups((prev) => {
      const next = new Set(prev);
      next.has(g) ? next.delete(g) : next.add(g);
      return next;
    });
  }

  function toggleCustom() {
    setUseCustom((v) => !v);
    if (!useCustom) setSelectedGroups(new Set());
  }

  function toggleMember(id: string) {
    setCustomIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function getTargetIds(): Promise<string[]> {
    if (useCustom) return [...customIds];
    // No groups selected = all members
    if (selectedGroups.size === 0) {
      const { data } = await supabase.from("users").select("id");
      return (data ?? []).map((r: any) => r.id);
    }
    // Fetch members for each selected group and union them
    const results = await Promise.all(
      [...selectedGroups].map((g) =>
        supabase.from("user_units").select("user_id, units!inner(name)").ilike("units.name", g)
          .then(({ data }) => (data ?? []).map((r: any) => r.user_id as string))
      )
    );
    return [...new Set(results.flat())];
  }

  async function send() {
    if (!title.trim()) return;
    if (useCustom && customIds.size === 0) { setErrorMsg("Select at least one member."); return; }
    setSending(true);
    setErrorMsg(null);

    const targetIds = await getTargetIds();
    const uniqueTargetIds = [...new Set(targetIds)];
    if (uniqueTargetIds.length === 0) { setErrorMsg("No recipients found."); setSending(false); return; }

    const broadcast_id = crypto.randomUUID();
    const rows = uniqueTargetIds.map((uid: string) => ({
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

    const { error: insertError } = await supabase.from("notification_logs").insert(rows);
    if (insertError) { setErrorMsg(`Send failed: ${insertError.message}`); setSending(false); return; }

    const pushResults = await Promise.all(
      uniqueTargetIds.map((user_id: string) =>
        fetch("/api/send-push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id, title: title.trim(), body: body.trim() || undefined, url: "/", critical: priority === "critical", location: location.trim() || undefined, sms: triggerSms }),
        }).then(r => r.json()).catch((e) => ({ error: e?.message }))
      )
    );
    const totalFcm = pushResults.reduce((s: number, r: any) => s + (r?.fcm ?? 0), 0);
    const totalSms = pushResults.reduce((s: number, r: any) => s + (r?.sms ? 1 : 0), 0);
    const pushErrors = pushResults.flatMap((r: any) => r?.errors ?? []);
    const fcmConfigured = pushResults.some((r: any) => r?.fcmConfigured);
    const fcmTokensFound = pushResults.reduce((s: number, r: any) => s + (r?.fcmTokensFound ?? 0), 0);
    const parts = [`${uniqueTargetIds.length} recipients`, fcmConfigured ? `FCM: ${totalFcm} sent (${fcmTokensFound} tokens)` : "FCM: not configured", totalSms ? `SMS: ${totalSms}` : "SMS: 0"];
    const summary = parts.join(" · ");
    if (pushErrors.length) console.warn("[send-push errors]", pushErrors);

    setSending(false);
    setSent(true);
    setErrorMsg(summary);
    onRefresh();
  }

  const filteredMembers = memberSearch.trim()
    ? members.filter((m) => [m.full_name, m.call_sign].join(" ").toLowerCase().includes(memberSearch.toLowerCase()))
    : members;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-t-3xl sm:rounded-2xl bg-zinc-900 p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-zinc-50 text-lg">Send Notification</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-lg leading-none">✕</button>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setPriority("critical")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${priority === "critical" ? "bg-red-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
            ⚠ Critical
          </button>
        </div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title *"
          className="w-full rounded-xl bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-[#E94E1B] placeholder-zinc-600" />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Description (optional)" rows={2}
          className="w-full rounded-xl bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-[#E94E1B] placeholder-zinc-600 resize-none" />
        <AddressSearch value={location} onChange={setLocation} />

        {/* Group selector */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-zinc-400">Send to</div>
          <div className="grid grid-cols-4 gap-2">
            {TEAM_GROUPS.map((g) => (
              <button key={g} onClick={() => toggleGroup(g)}
                className={`rounded-lg py-2 text-xs font-semibold transition ${!useCustom && (selectedGroups.has(g) || selectedGroups.size === 0) ? "bg-[#E94E1B] text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
                {g}
              </button>
            ))}
          </div>
          <button onClick={toggleCustom}
            className={`w-full rounded-lg py-2 text-xs font-semibold transition ${useCustom ? "bg-[#E94E1B] text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
            CUSTOM GROUP
          </button>
        </div>

        {/* Custom member picker */}
        {useCustom && (
          <div className="space-y-2">
            <input value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} placeholder="Search members…"
              className="w-full rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-[#E94E1B] placeholder-zinc-600" />
            <div className="max-h-44 overflow-y-auto rounded-lg border border-zinc-800 divide-y divide-zinc-800">
              {(memberSearch.trim() ? members.filter((m) => [m.full_name, m.call_sign].join(" ").toLowerCase().includes(memberSearch.toLowerCase())) : members).map((m) => (
                <button key={m.id} onClick={() => toggleMember(m.id)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-zinc-800 transition">
                  <span className={`h-4 w-4 rounded border-2 shrink-0 transition ${customIds.has(m.id) ? "bg-[#E94E1B] border-[#E94E1B]" : "border-zinc-600"}`} />
                  <span className="font-mono text-sm text-zinc-100">{m.call_sign ?? "—"}</span>
                  <span className="text-sm text-zinc-400">{m.full_name}</span>
                </button>
              ))}
            </div>
            {customIds.size > 0 && <div className="text-xs text-zinc-500">{customIds.size} selected</div>}
          </div>
        )}

        <label className="flex items-center gap-3 cursor-pointer select-none">
          <div onClick={() => setTriggerSms(v => !v)}
            className={`w-5 h-5 rounded flex items-center justify-center border-2 transition ${triggerSms ? "bg-[#E94E1B] border-[#E94E1B]" : "border-zinc-600 bg-transparent"}`}>
            {triggerSms && <svg viewBox="0 0 10 8" className="w-3 h-3 text-white fill-none stroke-current stroke-2"><polyline points="1,4 4,7 9,1"/></svg>}
          </div>
          <span className="text-sm font-medium text-zinc-300">Trigger SMS</span>
        </label>

        {!sent && errorMsg && (
          <p className="rounded-lg border px-3 py-2 text-sm bg-red-900/40 border-red-700/50 text-red-300">{errorMsg}</p>
        )}
        <button onClick={() => void send()} disabled={sending || !title.trim() || sent}
          className="w-full rounded-xl bg-[#E94E1B] py-3 font-semibold text-white disabled:opacity-50 transition hover:bg-orange-600">
          {sent ? "Sent ✓" : sending ? "Sending…" : "Send"}
        </button>
        {sent && errorMsg && (
          <div className="rounded-xl border border-zinc-600 bg-zinc-800 px-4 py-3 text-sm text-zinc-200">
            <div className="font-semibold text-green-400 mb-1">Notification sent</div>
            <div className="text-zinc-400">{errorMsg}</div>
          </div>
        )}
      </div>
    </div>
  );
}
