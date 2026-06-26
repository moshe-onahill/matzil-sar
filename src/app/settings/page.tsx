"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase";
import { getCurrentTestEmail, getStoredRole, UserRole } from "@/lib/dev-user";

const ROLES: UserRole[] = ["Member", "Dispatcher", "SAR Manager", "Global Admin"];
import { useToast } from "@/components/Toast";

type NotificationKey =
  | "incident_alerts"
  | "deployment_alerts"
  | "incident_updates"
  | "assignment_updates"
  | "critical_only";

type Channel = "push" | "sms" | "email";
type NotificationSettings = Record<NotificationKey, Record<Channel, boolean>>;

type UserProfile = {
  id: string;
  full_name: string | null;
  call_sign: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  is_on_duty: boolean | null;
  notification_settings: NotificationSettings | null;
  user_roles: { roles: { name: string }[] | { name: string } | null }[];
  user_units: { units: { name: string }[] | { name: string } | null }[];
};

type Certification = { id: string; name: string; expires_at: string | null };

type ChangeRequest = {
  id: string;
  field_name: string;
  old_value: string | null;
  new_value: string;
  status: "pending" | "approved" | "rejected";
  admin_note: string | null;
  created_at: string;
};

const defaultNotifications: NotificationSettings = {
  incident_alerts: { push: true, sms: false, email: false },
  deployment_alerts: { push: true, sms: false, email: false },
  incident_updates: { push: true, sms: false, email: false },
  assignment_updates: { push: true, sms: false, email: false },
  critical_only: { push: true, sms: true, email: false },
};


const FIELD_LABELS: Record<string, string> = {
  full_name: "Full Name",
  call_sign: "Call Sign",
};

export default function SettingsPage() {
  const toast = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);

  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [isOnDuty, setIsOnDuty] = useState(true);
  const [notifications, setNotifications] = useState<NotificationSettings>(defaultNotifications);
  const [saving, setSaving] = useState(false);

  // Cert request modal
  const [certRequestOpen, setCertRequestOpen] = useState(false);
  const [certRequestName, setCertRequestName] = useState("");
  const [certRequestNotes, setCertRequestNotes] = useState("");
  const [submittingCert, setSubmittingCert] = useState(false);

  // Edit-request modal
  const [requestField, setRequestField] = useState<"full_name" | "call_sign" | null>(null);
  const [requestValue, setRequestValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Theme
  const [lightMode, setLightMode] = useState(false);

  // Dev role switcher (V2 only)
  const isV2 = typeof window !== "undefined" && sessionStorage.getItem("v2-mode") === "1";
  const [devOpen, setDevOpen] = useState(false);
  const [devRole, setDevRole] = useState<UserRole>(getStoredRole());
  const tapCount = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void loadAll();
    setDevRole(getStoredRole());
    setLightMode(localStorage.getItem("theme") === "light");
  }, []);

  async function submitCertRequest() {
    if (!profile || !certRequestName.trim()) { toast("Certification name is required.", "error"); return; }
    setSubmittingCert(true);
    const { error } = await supabase.from("certification_requests").insert({
      user_id: profile.id, cert_name: certRequestName.trim(), notes: certRequestNotes.trim() || null,
    });
    setSubmittingCert(false);
    if (error) { toast(error.message, "error"); return; }
    toast("Request submitted. An admin will review it.", "success");
    setCertRequestOpen(false); setCertRequestName(""); setCertRequestNotes("");
  }

  function toggleTheme() {
    const next = !lightMode;
    setLightMode(next);
    localStorage.setItem("theme", next ? "light" : "dark");
    document.documentElement.classList.toggle("light-mode", next);
  }

  async function loadAll() {
    const { data, error } = await supabase
      .from("users")
      .select(`
        id, full_name, call_sign, email, phone, address,
        emergency_contact_name, emergency_contact_phone,
        is_on_duty, notification_settings,
        user_roles(roles(name)),
        user_units(units(name))
      `)
      .eq("email", getCurrentTestEmail())
      .single();

    if (error || !data) { toast(error?.message || "Could not load settings.", "error"); return; }

    const typed = data as UserProfile;
    setProfile(typed);
    setPhone(typed.phone || "");
    setAddress(typed.address || "");
    setEmergencyContactName(typed.emergency_contact_name || "");
    setEmergencyContactPhone(typed.emergency_contact_phone || "");
    setIsOnDuty(typed.is_on_duty !== false);
    setNotifications({ ...defaultNotifications, ...(typed.notification_settings || {}) });

    const [certRes, reqRes] = await Promise.all([
      supabase.from("certifications").select("id, name, expires_at").eq("user_id", typed.id).order("expires_at"),
      supabase.from("profile_change_requests")
        .select("id, field_name, old_value, new_value, status, admin_note, created_at")
        .eq("user_id", typed.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    setCertifications((certRes.data as Certification[]) ?? []);
    setChangeRequests((reqRes.data as ChangeRequest[]) ?? []);
  }

  function extractNames(items: { roles?: unknown; units?: unknown }[], key: "roles" | "units") {
    return items.flatMap((item) => {
      const value = item?.[key] as { name: string }[] | { name: string } | null;
      if (Array.isArray(value)) return value.map((x) => x?.name).filter(Boolean);
      if (value && typeof value === "object" && "name" in value) return [value.name];
      return [];
    });
  }

  function handleTitleTap() {
    if (!isV2) return;
    tapCount.current += 1;
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => { tapCount.current = 0; }, 1500);
    if (tapCount.current >= 5) { tapCount.current = 0; setDevOpen(true); }
  }

  function applyDevRole(role: UserRole) {
    window.localStorage.setItem("dev-role", role);
    setDevRole(role);
    setDevOpen(false);
    window.location.reload();
  }

  function applyNotificationPreset(preset: "all" | "critical" | "none") {
    const all = { push: true, sms: false, email: false };
    const off = { push: false, sms: false, email: false };
    if (preset === "all") {
      setNotifications({ incident_alerts: all, deployment_alerts: all, incident_updates: all, assignment_updates: all, critical_only: { push: true, sms: true, email: false } });
    } else if (preset === "critical") {
      setNotifications({ incident_alerts: off, deployment_alerts: off, incident_updates: off, assignment_updates: off, critical_only: { push: true, sms: true, email: false } });
    } else {
      setNotifications({ incident_alerts: off, deployment_alerts: off, incident_updates: off, assignment_updates: off, critical_only: off });
    }
  }

  function currentPreset(): "all" | "critical" | "none" | "custom" {
    if (Object.values(notifications).every((ch) => ch.push)) return "all";
    if (Object.values(notifications).every((ch) => !ch.push && !ch.sms && !ch.email)) return "none";
    if (!notifications.incident_alerts.push && !notifications.deployment_alerts.push &&
      !notifications.incident_updates.push && !notifications.assignment_updates.push &&
      notifications.critical_only.push) return "critical";
    return "custom";
  }

  async function saveSettings() {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase.from("users").update({
      phone: phone.trim() || null,
      address: address.trim() || null,
      emergency_contact_name: emergencyContactName.trim() || null,
      emergency_contact_phone: emergencyContactPhone.trim() || null,
      is_on_duty: isOnDuty,
      notification_settings: notifications,
    }).eq("id", profile.id);
    setSaving(false);
    if (error) { toast(error.message, "error"); return; }
    toast("Settings saved.", "success");
  }

  function openRequest(field: "full_name" | "call_sign") {
    if (!profile) return;
    // Check if there's already a pending request for this field
    const pending = changeRequests.find((r) => r.field_name === field && r.status === "pending");
    if (pending) { toast("You already have a pending request for this field.", "error"); return; }
    setRequestField(field);
    setRequestValue(field === "full_name" ? (profile.full_name || "") : (profile.call_sign || ""));
  }

  async function submitRequest() {
    if (!profile || !requestField) return;
    const trimmed = requestValue.trim();
    if (!trimmed) { toast("Value cannot be empty.", "error"); return; }
    const currentVal = requestField === "full_name" ? profile.full_name : profile.call_sign;
    if (trimmed === currentVal) { toast("No change from current value.", "error"); return; }

    setSubmitting(true);
    const { error } = await supabase.from("profile_change_requests").insert({
      user_id: profile.id,
      field_name: requestField,
      old_value: currentVal,
      new_value: trimmed,
    });
    setSubmitting(false);

    if (error) { toast(error.message, "error"); return; }
    toast("Change request submitted. An admin will review it.", "success");
    setRequestField(null);
    void loadAll();
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-black px-4 py-5 pb-28 text-white sm:p-6">
        <div className="mx-auto max-w-3xl space-y-4 animate-pulse">
          <div className="h-8 w-1/3 rounded bg-gray-800" />
          <div className="rounded-xl bg-gray-900 p-5 space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-10 w-full rounded bg-gray-700" />)}
          </div>
        </div>
      </main>
    );
  }

  const roles = extractNames(profile.user_roles ?? [], "roles");
  const units = extractNames(profile.user_units ?? [], "units");
  const pendingRequests = changeRequests.filter((r) => r.status === "pending");

  return (
    <main className="min-h-screen bg-black px-4 py-5 pb-28 text-white sm:p-6 sm:pb-28">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href="/" className="rounded border border-gray-800 bg-gray-900 px-4 py-2 text-sm">
            Dashboard
          </Link>
        </div>

        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p
            className="mt-1 select-none text-sm text-zinc-600"
            onClick={handleTitleTap}
            style={{ WebkitTapHighlightColor: "transparent", cursor: "default", padding: "10px 0", display: "inline-block" }}
          >
            Matzil SAR · v1.0
          </p>
        </div>

        {/* Profile card */}
        <section className="rounded-xl bg-gray-900 p-5 space-y-4">
          <div>
            <div className="text-xl font-semibold">Profile</div>
            <div className="text-sm text-gray-400">
              Name and call sign changes require admin approval. Contact info saves immediately.
            </div>
          </div>

          {/* Name */}
          <ProfileField
            label="Full Name"
            value={profile.full_name}
            fieldKey="full_name"
            requests={changeRequests}
            onRequest={() => openRequest("full_name")}
          />

          {/* Call sign */}
          <ProfileField
            label="Call Sign"
            value={profile.call_sign}
            fieldKey="call_sign"
            requests={changeRequests}
            onRequest={() => openRequest("call_sign")}
          />

          {/* Role + unit — read-only */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-black/30 px-4 py-3">
              <div className="text-xs text-gray-500 mb-1">Role</div>
              <div className="text-sm font-medium">{roles.length ? roles.join(", ") : "None"}</div>
            </div>
            <div className="rounded-lg bg-black/30 px-4 py-3">
              <div className="text-xs text-gray-500 mb-1">Unit</div>
              <div className="text-sm font-medium">{units.length ? units.join(", ") : "None"}</div>
            </div>
          </div>

          {/* Editable contact fields */}
          <div className="space-y-2 pt-1">
            <label className="block">
              <span className="text-xs text-gray-500 mb-1 block">Phone</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number"
                className="w-full rounded-lg bg-black/40 border border-zinc-800 px-4 py-3 text-sm focus:border-zinc-600 focus:outline-none" />
            </label>
            <label className="block">
              <span className="text-xs text-gray-500 mb-1 block">Address</span>
              <textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address" rows={2}
                className="w-full rounded-lg bg-black/40 border border-zinc-800 px-4 py-3 text-sm focus:border-zinc-600 focus:outline-none resize-none" />
            </label>
            <label className="block">
              <span className="text-xs text-gray-500 mb-1 block">Emergency Contact Name</span>
              <input value={emergencyContactName} onChange={(e) => setEmergencyContactName(e.target.value)} placeholder="Emergency contact name"
                className="w-full rounded-lg bg-black/40 border border-zinc-800 px-4 py-3 text-sm focus:border-zinc-600 focus:outline-none" />
            </label>
            <label className="block">
              <span className="text-xs text-gray-500 mb-1 block">Emergency Contact Phone</span>
              <input value={emergencyContactPhone} onChange={(e) => setEmergencyContactPhone(e.target.value)} placeholder="Emergency contact phone"
                className="w-full rounded-lg bg-black/40 border border-zinc-800 px-4 py-3 text-sm focus:border-zinc-600 focus:outline-none" />
            </label>
          </div>
        </section>

        {/* Duty status */}
        <section className="rounded-xl bg-gray-900 p-5 space-y-3">
          <div>
            <div className="text-xl font-semibold">Duty Status</div>
            <div className="text-sm text-gray-400">Off duty members will not receive incident notifications.</div>
          </div>
          <button
            onClick={() => setIsOnDuty((v) => !v)}
            className={`w-full rounded-xl px-4 py-3 font-semibold transition ${isOnDuty ? "bg-green-700 hover:bg-green-600" : "bg-zinc-800 hover:bg-zinc-700 text-zinc-400"}`}
          >
            {isOnDuty ? "On Duty" : "Off Duty"}
          </button>
        </section>

        {/* Notifications */}
        <section className="rounded-xl bg-gray-900 p-5 space-y-3">
          <div>
            <div className="text-xl font-semibold">Notifications</div>
            <div className="text-sm text-gray-400">Choose how much you want to hear from us.</div>
          </div>
          <PushSetupButton />
          {(() => {
            const preset = currentPreset();
            return (
              <div className="space-y-2">
                {[
                  { id: "all", label: "All Alerts", desc: "Every incident and update" },
                  { id: "critical", label: "Critical Only", desc: "Emergency callouts only" },
                  { id: "none", label: "None", desc: "No push notifications" },
                ].map(({ id, label, desc }) => (
                  <button
                    key={id}
                    onClick={() => applyNotificationPreset(id as "all" | "critical" | "none")}
                    className={`w-full rounded-xl p-4 text-left transition ${
                      preset === id ? "bg-red-700 border border-red-500" : "bg-gray-800 border border-transparent hover:bg-gray-700"
                    }`}
                  >
                    <div className="font-semibold">{label}</div>
                    <div className="mt-0.5 text-sm text-gray-300">{desc}</div>
                  </button>
                ))}
              </div>
            );
          })()}
        </section>

        {/* Certifications */}
        <section className="rounded-xl bg-gray-900 p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-xl font-semibold">Certifications</div>
              <div className="text-sm text-gray-400">Managed by an admin. You can request to add one.</div>
            </div>
            <button onClick={() => setCertRequestOpen(true)}
              className="shrink-0 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 transition">
              + Request
            </button>
          </div>
          {certifications.length === 0 ? (
            <div className="rounded-lg bg-black/30 p-4 text-gray-400">No certifications listed.</div>
          ) : (
            <div className="space-y-2">
              {certifications.map((cert) => {
                const expiry = cert.expires_at ? new Date(cert.expires_at) : null;
                const daysLeft = expiry ? Math.ceil((expiry.getTime() - Date.now()) / 86400000) : null;
                const expired = daysLeft !== null && daysLeft < 0;
                const expiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30;
                return (
                  <div key={cert.id} className="flex items-center justify-between rounded-lg bg-black/30 px-4 py-3">
                    <div>
                      <div className="font-medium">{cert.name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {expiry ? expiry.toLocaleDateString() : "No expiration"}
                      </div>
                    </div>
                    {expired && <span className="text-xs font-semibold text-red-400 bg-red-900/30 rounded px-2 py-1">Expired</span>}
                    {expiringSoon && <span className="text-xs font-semibold text-yellow-400 bg-yellow-900/30 rounded px-2 py-1">{daysLeft}d left</span>}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Pending change requests status */}
        {pendingRequests.length > 0 && (
          <section className="rounded-xl border border-yellow-800 bg-yellow-950/20 p-5 space-y-2">
            <div className="text-sm font-semibold text-yellow-400">Pending Change Requests</div>
            {pendingRequests.map((r) => (
              <div key={r.id} className="rounded-lg bg-black/30 px-4 py-3 text-sm">
                <span className="text-zinc-400">{FIELD_LABELS[r.field_name] ?? r.field_name}:</span>{" "}
                <span className="text-zinc-200 line-through mr-2">{r.old_value || "—"}</span>
                <span className="text-zinc-50">→ {r.new_value}</span>
                <span className="ml-3 text-xs text-yellow-500">awaiting review</span>
              </div>
            ))}
          </section>
        )}

        <button
          onClick={() => void saveSettings()}
          disabled={saving}
          className="w-full rounded-xl bg-red-600 px-4 py-3 font-semibold hover:bg-red-500 disabled:opacity-60 transition"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>

        <button
          onClick={async () => {
            if (!profile) return;
            const alertTitle = "🚨 Matzil SAR Alert";
            const alertBody = "This is a test alert — notifications are working correctly.";

            // Play alert tone via Web Audio API
            try {
              const ctx = new AudioContext();
              const gain = ctx.createGain();
              gain.connect(ctx.destination);
              [0, 0.3, 0.6].forEach((offset) => {
                const osc = ctx.createOscillator();
                osc.connect(gain);
                osc.type = "square";
                osc.frequency.value = 880;
                gain.gain.setValueAtTime(0.25, ctx.currentTime + offset);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.25);
                osc.start(ctx.currentTime + offset);
                osc.stop(ctx.currentTime + offset + 0.25);
              });
            } catch {}

            // Show browser Notification popup
            try {
              let perm = Notification.permission;
              if (perm === "default") perm = await Notification.requestPermission();
              if (perm === "granted") {
                new Notification(alertTitle, { body: alertBody, icon: "/icon-192.png" });
              }
            } catch {}

            // Log to notification_logs so it appears in the Alerts page
            await supabase.from("notification_logs").insert({
              user_id: profile.id,
              channel: "app",
              notification_type: "test",
              title: alertTitle,
              body: alertBody,
              status: "sent",
            });

            // Also send FCM/VAPID push for devices that support it
            void fetch("/api/send-push", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ user_id: profile.id, title: alertTitle, body: alertBody, url: "/notifications" }),
            });

            toast("Test alert sent!", "success");
          }}
          className="w-full rounded-xl bg-gray-900 px-4 py-3 font-medium text-gray-300 hover:bg-gray-800 transition"
        >
          Test Alert
        </button>

        {/* Theme toggle */}
        <section className="rounded-xl bg-gray-900 p-5 flex items-center justify-between">
          <div>
            <div className="text-xl font-semibold">Appearance</div>
            <div className="text-sm text-gray-400">{lightMode ? "Light mode" : "Dark mode"}</div>
          </div>
          <button
            onClick={toggleTheme}
            className={`relative h-7 w-13 rounded-full transition-colors duration-200 ${lightMode ? "bg-red-600" : "bg-zinc-700"}`}
            style={{ width: 52 }}
            aria-label="Toggle light/dark mode"
          >
            <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ${lightMode ? "translate-x-6" : "translate-x-0.5"}`} />
          </button>
        </section>

        <button
          onClick={async () => {
            window.localStorage.removeItem("auth-email");
            window.localStorage.removeItem("real-role");
            window.localStorage.removeItem("dev-role");
            window.localStorage.removeItem("session-temporary");
            await supabase.auth.signOut({ scope: "global" });
            window.location.href = "/login";
          }}
          className="w-full rounded-xl bg-gray-900 px-4 py-3 font-medium text-gray-400 hover:bg-gray-800 transition"
        >
          Sign Out
        </button>
      </div>

      {/* Change request modal */}
      {requestField && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4" onClick={() => setRequestField(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-900 p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div>
              <div className="text-lg font-bold text-zinc-50">Request Change</div>
              <div className="text-sm text-zinc-500 mt-0.5">
                Changing your {FIELD_LABELS[requestField]} requires admin approval.
              </div>
            </div>
            <div>
              <div className="text-xs text-zinc-500 mb-1">Current value</div>
              <div className="rounded-lg bg-zinc-800 px-4 py-3 text-sm text-zinc-400">
                {(requestField === "full_name" ? profile.full_name : profile.call_sign) || "—"}
              </div>
            </div>
            <div>
              <div className="text-xs text-zinc-500 mb-1">New value</div>
              <input
                autoFocus
                value={requestValue}
                onChange={(e) => setRequestValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void submitRequest()}
                placeholder={`New ${FIELD_LABELS[requestField]}`}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-50 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setRequestField(null)}
                className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-700 transition">
                Cancel
              </button>
              <button onClick={() => void submitRequest()} disabled={submitting}
                className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50 transition">
                {submitting ? "Submitting…" : "Submit Request"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Cert request modal */}
      {certRequestOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4" onClick={() => setCertRequestOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-900 p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div>
              <div className="text-lg font-bold text-zinc-50">Request Certification</div>
              <div className="text-sm text-zinc-500 mt-0.5">An admin will review and approve your request.</div>
            </div>
            <input autoFocus value={certRequestName} onChange={(e) => setCertRequestName(e.target.value)}
              placeholder="Certification name (e.g. Wilderness First Aid)"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-50 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none" />
            <textarea value={certRequestNotes} onChange={(e) => setCertRequestNotes(e.target.value)}
              placeholder="Notes / issuing body / expiry (optional)" rows={3}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-50 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none resize-none" />
            <div className="flex gap-2">
              <button onClick={() => setCertRequestOpen(false)}
                className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-700 transition">Cancel</button>
              <button onClick={() => void submitCertRequest()} disabled={submittingCert}
                className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50 transition">
                {submittingCert ? "Submitting…" : "Submit"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Dev role switcher — V2 only, open with 5 taps on page title */}
      {isV2 && devOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4" onClick={() => setDevOpen(false)}>
          <div className="w-full max-w-xs rounded-2xl bg-zinc-900 border border-zinc-700 p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-lg font-bold text-zinc-50">View As Role</div>
            <div className="text-sm text-zinc-500">Current: <span className="text-zinc-300">{devRole}</span></div>
            <div className="grid grid-cols-2 gap-2">
              {ROLES.map((r) => (
                <button key={r} onClick={() => applyDevRole(r)}
                  className={`rounded-xl px-4 py-3 text-sm font-medium transition ${devRole === r ? "bg-[#E94E1B] text-white" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}>
                  {r}
                </button>
              ))}
            </div>
            <button onClick={() => setDevOpen(false)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-700">
              Close
            </button>
          </div>
        </div>,
        document.body
      )}

    </main>
  );
}

function ProfileField({
  label, value, fieldKey, requests, onRequest,
}: {
  label: string;
  value: string | null;
  fieldKey: string;
  requests: ChangeRequest[];
  onRequest: () => void;
}) {
  const pending = requests.find((r) => r.field_name === fieldKey && r.status === "pending");
  const lastApproved = requests.find((r) => r.field_name === fieldKey && r.status === "approved");
  const lastRejected = requests.find((r) => r.field_name === fieldKey && r.status === "rejected");

  return (
    <div className="rounded-lg bg-black/30 px-4 py-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-xs text-gray-500 mb-0.5">{label}</div>
        <div className="font-medium truncate">{value || <span className="text-zinc-600">Not set</span>}</div>
        {pending && (
          <div className="mt-1 text-xs text-yellow-400">
            Pending: <span className="text-zinc-300">{pending.new_value}</span>
          </div>
        )}
        {lastRejected && !pending && (
          <div className="mt-1 text-xs text-red-400">
            Last request rejected{lastRejected.admin_note ? `: ${lastRejected.admin_note}` : ""}
          </div>
        )}
        {lastApproved && !pending && !lastRejected && (
          <div className="mt-1 text-xs text-green-500">Last change approved</div>
        )}
      </div>
      <button
        onClick={onRequest}
        disabled={!!pending}
        className="shrink-0 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
      >
        {pending ? "Pending…" : "Request Change"}
      </button>
    </div>
  );
}

function PushSetupButton() {
  const [status, setStatus] = useState<"idle" | "registering" | "ok" | "error">("idle");
  const [detail, setDetail] = useState("");
  const [token, setToken] = useState("");
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    import("@capacitor/core").then(({ Capacitor }) => {
      setIsNative(Capacitor.isNativePlatform());
    });
  }, []);

  if (!isNative) return null;

  async function register() {
    setStatus("registering");
    setDetail("");
    setToken("");
    try {
      const { Capacitor } = await import("@capacitor/core");
      setDetail("Native: " + Capacitor.getPlatform());

      const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");
      const perm = await FirebaseMessaging.requestPermissions();
      setDetail("Permission: " + perm.receive);
      if (perm.receive !== "granted") { setStatus("error"); return; }

      const { token: t } = await FirebaseMessaging.getToken();
      if (!t) { setDetail("No token returned"); setStatus("error"); return; }
      setToken(t.slice(0, 20) + "…");

      const { supabase } = await import("@/lib/supabase");
      const { data: authData } = await supabase.auth.getUser();
      const email = authData.user?.email;
      setDetail("Email: " + (email ?? "none"));
      if (!email) { setStatus("error"); return; }

      const { data: user } = await supabase.from("users").select("id").ilike("email", email).maybeSingle();
      if (!user?.id) { setDetail("User not found in DB for: " + email); setStatus("error"); return; }

      const { error } = await supabase.from("fcm_tokens").upsert(
        { user_id: user.id, token: t, platform: Capacitor.getPlatform() },
        { onConflict: "user_id,platform" }
      );
      if (error) { setDetail("DB error: " + error.message); setStatus("error"); return; }

      setDetail("Saved for user " + user.id.slice(0, 8) + "…");
      setStatus("ok");
    } catch (e: any) {
      setDetail(e?.message ?? String(e));
      setStatus("error");
    }
  }

  return (
    <button
      onClick={() => void register()}
      disabled={status === "registering"}
      className={`w-full rounded-xl p-4 text-left transition border ${
        status === "ok" ? "bg-green-900/40 border-green-700" :
        status === "error" ? "bg-red-900/40 border-red-700" :
        "bg-gray-800 border-transparent hover:bg-gray-700"
      }`}
    >
      <div className="font-semibold text-sm">
        {status === "registering" ? "Registering…" :
         status === "ok" ? "✓ Push notifications active" :
         status === "error" ? "Push setup failed — tap to retry" :
         "Set up push notifications"}
      </div>
      {detail && <div className="mt-1 text-xs text-gray-400 break-all">{detail}</div>}
      {token && <div className="mt-0.5 text-xs text-gray-500">Token: {token}</div>}
      {!detail && <div className="mt-0.5 text-xs text-gray-400">
        {status === "ok" ? "Your device is registered to receive alerts" : "Tap to register this device for push alerts"}
      </div>}
    </button>
  );
}
