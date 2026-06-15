"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase";
import { getCurrentTestEmail, getStoredRole, setStoredRole, UserRole } from "@/lib/dev-user";
import { useToast } from "@/components/Toast";

type NotificationKey =
  | "incident_alerts"
  | "deployment_alerts"
  | "incident_updates"
  | "assignment_updates"
  | "critical_only";

type Channel = "push" | "sms" | "email";

type NotificationSettings = Record<
  NotificationKey,
  Record<Channel, boolean>
>;

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

type Certification = {
  id: string;
  name: string;
  expires_at: string | null;
};

const defaultNotifications: NotificationSettings = {
  incident_alerts: { push: true, sms: false, email: false },
  deployment_alerts: { push: true, sms: false, email: false },
  incident_updates: { push: true, sms: false, email: false },
  assignment_updates: { push: true, sms: false, email: false },
  critical_only: { push: true, sms: true, email: false },
};


const ROLES: UserRole[] = ["Member", "Dispatcher", "SAR Manager", "Global Admin"];

export default function SettingsPage() {
  const toast = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [certifications, setCertifications] = useState<Certification[]>([]);

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [isOnDuty, setIsOnDuty] = useState(true);
  const [notifications, setNotifications] = useState<NotificationSettings>(defaultNotifications);
  const [saving, setSaving] = useState(false);

  // Hidden dev panel state
  const [devOpen, setDevOpen] = useState(false);
  const [devRole, setDevRole] = useState<UserRole>("Member");
  const tapCount = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void loadSettings();
    setDevRole(getStoredRole());
  }, []);

  function handleTitleTap() {
    tapCount.current += 1;
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => { tapCount.current = 0; }, 1500);
    if (tapCount.current >= 5) {
      tapCount.current = 0;
      setDevOpen(true);
    }
  }

  function applyDevRole(role: UserRole) {
    setStoredRole(role);
    setDevRole(role);
    setDevOpen(false);
    window.location.reload();
  }

  async function loadSettings() {
    const { data, error } = await supabase
      .from("users")
      .select(`
        id,
        full_name,
        call_sign,
        email,
        phone,
        address,
        emergency_contact_name,
        emergency_contact_phone,
        is_on_duty,
        notification_settings,
        user_roles (
          roles (
            name
          )
        ),
        user_units (
          units (
            name
          )
        )
      `)
      .eq("email", getCurrentTestEmail())
      .single();

    if (error || !data) {
      toast(error?.message || "Could not load settings.", "error");
      return;
    }

    const typed = data as UserProfile;
    setProfile(typed);

    setEmail(typed.email || "");
    setPhone(typed.phone || "");
    setAddress(typed.address || "");
    setEmergencyContactName(typed.emergency_contact_name || "");
    setEmergencyContactPhone(typed.emergency_contact_phone || "");
    setIsOnDuty(typed.is_on_duty !== false);
    setNotifications({
      ...defaultNotifications,
      ...(typed.notification_settings || {}),
    });

    const { data: certData } = await supabase
      .from("certifications")
      .select("id, name, expires_at")
      .eq("user_id", typed.id)
      .order("expires_at", { ascending: true });

    setCertifications((certData as Certification[]) ?? []);
  }

  function extractNames(items: any[], key: "roles" | "units") {
    return items.flatMap((item) => {
      const value = item?.[key];
      if (Array.isArray(value)) return value.map((x) => x?.name).filter(Boolean);
      if (value?.name) return [value.name];
      return [];
    });
  }

  function applyNotificationPreset(preset: "all" | "critical" | "none") {
    if (preset === "all") {
      setNotifications({
        incident_alerts: { push: true, sms: false, email: false },
        deployment_alerts: { push: true, sms: false, email: false },
        incident_updates: { push: true, sms: false, email: false },
        assignment_updates: { push: true, sms: false, email: false },
        critical_only: { push: true, sms: true, email: false },
      });
    } else if (preset === "critical") {
      setNotifications({
        incident_alerts: { push: false, sms: false, email: false },
        deployment_alerts: { push: false, sms: false, email: false },
        incident_updates: { push: false, sms: false, email: false },
        assignment_updates: { push: false, sms: false, email: false },
        critical_only: { push: true, sms: true, email: false },
      });
    } else {
      setNotifications({
        incident_alerts: { push: false, sms: false, email: false },
        deployment_alerts: { push: false, sms: false, email: false },
        incident_updates: { push: false, sms: false, email: false },
        assignment_updates: { push: false, sms: false, email: false },
        critical_only: { push: false, sms: false, email: false },
      });
    }
  }

  function currentPreset(): "all" | "critical" | "none" | "custom" {
    const allOn = Object.values(notifications).every((ch) => ch.push);
    const allOff = Object.values(notifications).every((ch) => !ch.push && !ch.sms && !ch.email);
    const critOnly = !notifications.incident_alerts.push && !notifications.deployment_alerts.push &&
      !notifications.incident_updates.push && !notifications.assignment_updates.push &&
      notifications.critical_only.push;
    if (allOn) return "all";
    if (allOff) return "none";
    if (critOnly) return "critical";
    return "custom";
  }

  async function saveSettings() {
    if (!profile) return;

    if (!email.trim()) { toast("Email is required.", "error"); return; }

    setSaving(true);

    const { error } = await supabase
      .from("users")
      .update({
        email: email.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
        emergency_contact_name: emergencyContactName.trim() || null,
        emergency_contact_phone: emergencyContactPhone.trim() || null,
        is_on_duty: isOnDuty,
        notification_settings: notifications,
      })
      .eq("id", profile.id);

    setSaving(false);

    if (error) { toast(error.message, "error"); return; }

    toast("Settings saved.", "success");
    await loadSettings();
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-black px-4 py-5 pb-28 text-white sm:p-6 sm:pb-28">
        <div className="mx-auto max-w-3xl space-y-4 animate-pulse">
          <div className="h-8 w-1/3 rounded bg-gray-800" />
          <div className="rounded-xl bg-gray-900 p-5 space-y-3">
            <div className="h-5 w-1/2 rounded bg-gray-700" />
            <div className="h-4 w-1/3 rounded bg-gray-700" />
            <div className="h-10 w-full rounded bg-gray-700" />
            <div className="h-10 w-full rounded bg-gray-700" />
          </div>
        </div>
      </main>
    );
  }

  const roles = extractNames(profile.user_roles ?? [], "roles");
  const units = extractNames(profile.user_units ?? [], "units");

  return (
    <main className="min-h-screen bg-black px-4 py-5 pb-28 text-white sm:p-6 sm:pb-28">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            href="/"
            className="rounded border border-gray-800 bg-gray-900 px-4 py-2 text-sm"
          >
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

        <section className="rounded-xl bg-gray-900 p-5 space-y-3">
          <div>
            <div className="text-xl font-semibold">Account Center</div>
            <div className="text-sm text-gray-400">
              Contact information can be edited. Roles, units, and certifications are managed by an admin.
            </div>
          </div>

          <div className="rounded-lg bg-black/30 p-4">
            <div className="font-medium">{profile.full_name || "Unnamed User"}</div>
            <div className="text-sm text-gray-400">
              Call Sign: {profile.call_sign || "None"}
            </div>
            <div className="mt-2 text-sm text-gray-400">
              Roles: {roles.length ? roles.join(", ") : "None"}
            </div>
            <div className="text-sm text-gray-400">
              Units: {units.length ? units.join(", ") : "None"}
            </div>
          </div>

          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded bg-black px-4 py-3"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone number"
            className="w-full rounded bg-black px-4 py-3"
          />
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Address"
            rows={3}
            className="w-full rounded bg-black px-4 py-3"
          />
          <input
            value={emergencyContactName}
            onChange={(e) => setEmergencyContactName(e.target.value)}
            placeholder="Emergency contact name"
            className="w-full rounded bg-black px-4 py-3"
          />
          <input
            value={emergencyContactPhone}
            onChange={(e) => setEmergencyContactPhone(e.target.value)}
            placeholder="Emergency contact phone"
            className="w-full rounded bg-black px-4 py-3"
          />
        </section>

        <section className="rounded-xl bg-gray-900 p-5 space-y-3">
          <div>
            <div className="text-xl font-semibold">Duty Status</div>
            <div className="text-sm text-gray-400">
              Off duty users will not receive notifications.
            </div>
          </div>

          <button
            onClick={() => setIsOnDuty((v) => !v)}
            className={`w-full rounded px-4 py-3 font-medium ${
              isOnDuty ? "bg-green-700" : "bg-gray-700"
            }`}
          >
            {isOnDuty ? "On Duty" : "Off Duty"}
          </button>
        </section>

        <section className="rounded-xl bg-gray-900 p-5 space-y-3">
          <div>
            <div className="text-xl font-semibold">Notifications</div>
            <div className="text-sm text-gray-400">Choose how much you want to hear from us.</div>
          </div>

          {(() => {
            const preset = currentPreset();
            return (
              <div className="space-y-2">
                {[
                  { id: "all", label: "All Alerts", desc: "Get notified for every incident and update" },
                  { id: "critical", label: "Critical Only", desc: "Only emergency callouts — no routine updates" },
                  { id: "none", label: "None", desc: "No push notifications" },
                ] .map(({ id, label, desc }) => (
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

        <section className="rounded-xl bg-gray-900 p-5 space-y-3">
          <div>
            <div className="text-xl font-semibold">Certifications</div>
            <div className="text-sm text-gray-400">
              Certifications are managed by an admin.
            </div>
          </div>

          {certifications.length === 0 ? (
            <div className="rounded-lg bg-black/30 p-4 text-gray-400">
              No certifications listed.
            </div>
          ) : (
            <div className="space-y-2">
              {certifications.map((cert) => (
                <div key={cert.id} className="rounded-lg bg-black/30 p-4">
                  <div className="font-medium">{cert.name}</div>
                  <div className="text-sm text-gray-400">
                    Expires:{" "}
                    {cert.expires_at
                      ? new Date(cert.expires_at).toLocaleDateString()
                      : "No expiration"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <button
          onClick={() => void saveSettings()}
          disabled={saving}
          className="w-full rounded bg-red-600 px-4 py-3 font-medium disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>

        <button
          onClick={async () => {
            window.localStorage.removeItem("auth-email");
            window.localStorage.removeItem("real-role");
            window.localStorage.removeItem("dev-role");
            await supabase.auth.signOut();
            window.location.href = "/login";
          }}
          className="w-full rounded bg-gray-900 px-4 py-3 font-medium text-gray-400 hover:bg-gray-800"
        >
          Sign Out
        </button>
      </div>

      {/* Hidden dev panel — rendered via portal so fixed positioning is never trapped */}
      {devOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4" onClick={() => setDevOpen(false)}>
          <div className="w-full max-w-xs rounded-2xl bg-zinc-900 border border-zinc-700 p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-lg font-bold text-zinc-50">Dev: View As Role</div>
            <div className="text-sm text-zinc-500">Current: <span className="text-zinc-300">{devRole}</span></div>
            <div className="grid grid-cols-2 gap-2">
              {ROLES.map((r) => (
                <button
                  key={r}
                  onClick={() => applyDevRole(r)}
                  className={`rounded-xl px-4 py-3 text-sm font-medium transition ${
                    devRole === r ? "bg-red-600 text-white" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <button
              onClick={() => setDevOpen(false)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-700"
            >
              Close
            </button>
          </div>
        </div>,
        document.body
      )}
    </main>
  );
}
