"use client";

import { useEffect, useState } from "react";
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
  title: string;
  body: string | null;
  location: string | null;
  priority: string | null;
  created_at: string;
};

const ADMIN_ROLES = ["Dispatcher", "SAR Manager", "Global Admin"];

export default function V1Shell() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notifications, setNotifications] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [accountOpen, setAccountOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const role = getStoredRole();
  const isAdmin = ADMIN_ROLES.includes(role);

  useEffect(() => {
    void init();
  }, []);

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

      const { data: notifs } = await supabase
        .from("notification_logs")
        .select("id,title,body,location,priority,created_at")
        .eq("user_id", (user as any).id)
        .order("created_at", { ascending: false })
        .limit(100);

      setNotifications((notifs ?? []) as Notif[]);

      supabase
        .channel("v1-notifs")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notification_logs", filter: `user_id=eq.${(user as any).id}` },
          (payload) => setNotifications((prev) => [payload.new as Notif, ...prev])
        )
        .subscribe();
    }

    setLoading(false);
  }

  function fmt(d: string) {
    return new Date(d).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
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
            <div
              key={n.id}
              className={`rounded-2xl p-4 space-y-1.5 ${
                n.priority === "critical" ? "bg-red-600" : "bg-[#E94E1B]"
              } text-white`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-bold text-base leading-snug">{n.title}</span>
                <span className="text-xs opacity-70 shrink-0 mt-0.5">{fmt(n.created_at)}</span>
              </div>
              {n.body && <p className="text-sm opacity-90 leading-relaxed">{n.body}</p>}
              {n.location && (
                <p className="text-xs opacity-75 flex items-center gap-1">
                  <span>📍</span><span>{n.location}</span>
                </p>
              )}
            </div>
          ))
        )}
      </div>

      {/* Account Panel */}
      {accountOpen && (
        <AccountPanel
          profile={profile}
          isAdmin={isAdmin}
          onClose={() => setAccountOpen(false)}
        />
      )}

      {/* Compose Modal */}
      {isAdmin && composeOpen && (
        <ComposeModal onClose={() => setComposeOpen(false)} />
      )}
    </div>
  );
}

function AccountPanel({
  profile,
  isAdmin,
  onClose,
}: {
  profile: Profile | null;
  isAdmin: boolean;
  onClose: () => void;
}) {
  const [resetSent, setResetSent] = useState(false);

  async function resetPassword() {
    if (!profile?.email) return;
    await supabase.auth.resetPasswordForEmail(profile.email, {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    });
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

  function switchToV2() {
    sessionStorage.setItem("v2-mode", "1");
    window.location.reload();
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
              {profile.call_sign && (
                <div className="text-sm font-mono font-semibold text-[#E94E1B] mt-0.5">{profile.call_sign}</div>
              )}
            </div>

            <div className="space-y-3">
              <InfoRow label="Email" value={profile.email} />
              <InfoRow label="Phone" value={profile.phone} />
              <InfoRow label="Home Address" value={profile.home_address} />
              {profile.teams.length > 0 && (
                <InfoRow label="Assigned Teams" value={profile.teams.join(", ")} />
              )}
            </div>

            {(profile.car_make || profile.car_model || profile.car_color || profile.license_plate_number) && (
              <div className="rounded-xl bg-zinc-800 p-4 space-y-1.5">
                <div className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Vehicle</div>
                <div className="text-sm text-zinc-100">
                  {[profile.car_color, profile.car_make, profile.car_model].filter(Boolean).join(" ") || "—"}
                </div>
                {profile.license_plate_number && (
                  <div className="text-sm text-zinc-400">
                    {[profile.license_plate_state, profile.license_plate_number].filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2 pt-2 border-t border-zinc-800">
              <button
                onClick={() => void resetPassword()}
                disabled={resetSent}
                className="w-full rounded-xl bg-zinc-800 px-4 py-3 text-sm font-medium text-zinc-200 hover:bg-zinc-700 transition text-left"
              >
                {resetSent ? "Reset email sent ✓" : "Reset Password"}
              </button>

              {isAdmin && (
                <button
                  onClick={switchToV2}
                  className="w-full rounded-xl bg-zinc-800 px-4 py-3 text-sm font-medium text-[#E94E1B] hover:bg-zinc-700 transition text-left"
                >
                  Switch to V2 →
                </button>
              )}

              <button
                onClick={() => void logout()}
                className="w-full rounded-xl bg-zinc-800 px-4 py-3 text-sm font-medium text-red-400 hover:bg-zinc-700 transition text-left"
              >
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

function ComposeModal({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [location, setLocation] = useState("");
  const [priority, setPriority] = useState<"routine" | "critical">("routine");
  const [target, setTarget] = useState<"all" | "duty">("all");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function send() {
    if (!title.trim()) return;
    setSending(true);

    const query = target === "all"
      ? supabase.from("users").select("id").eq("is_active", true)
      : supabase.from("users").select("id").eq("is_on_duty", true);

    const { data: recipients } = await query;
    const targetIds = (recipients ?? []).map((r: any) => r.id);

    const email = getCurrentTestEmail();
    const { data: sender } = await supabase.from("users").select("id").eq("email", email).single();

    await supabase.from("notification_logs").insert(
      targetIds.map((uid) => ({
        user_id: uid,
        sender_id: (sender as any)?.id ?? null,
        channel: "app",
        notification_type: "broadcast",
        title: title.trim(),
        body: body.trim() || null,
        location: location.trim() || null,
        priority,
        status: "sent",
      }))
    );

    await Promise.all(
      targetIds.map((user_id) =>
        fetch("/api/send-push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id, title: title.trim(), body: body.trim() || undefined, url: "/", critical: priority === "critical" }),
        })
      )
    );

    setSending(false);
    setSent(true);
    setTimeout(onClose, 1200);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-t-3xl sm:rounded-2xl bg-zinc-900 p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-zinc-50 text-lg">Send Notification</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-lg leading-none">✕</button>
        </div>

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

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title *"
          className="w-full rounded-xl bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-[#E94E1B] placeholder-zinc-600"
        />

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Description (optional)"
          rows={2}
          className="w-full rounded-xl bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-[#E94E1B] placeholder-zinc-600 resize-none"
        />

        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Location (optional)"
          className="w-full rounded-xl bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-[#E94E1B] placeholder-zinc-600"
        />

        <div className="flex gap-2">
          {(["all", "duty"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTarget(t)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                target === t ? "bg-zinc-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              {t === "all" ? "All members" : "On-duty only"}
            </button>
          ))}
        </div>

        <button
          onClick={() => void send()}
          disabled={sending || !title.trim() || sent}
          className="w-full rounded-xl bg-[#E94E1B] py-3 font-semibold text-white disabled:opacity-50 transition hover:bg-orange-600"
        >
          {sent ? "Sent ✓" : sending ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  );
}
