"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import RoleSwitcher from "@/components/RoleSwitcher";
import { getCurrentTestEmail } from "@/lib/dev-user";

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

const notificationLabels: Record<NotificationKey, string> = {
  incident_alerts: "Incident alerts",
  deployment_alerts: "Deployment alerts",
  incident_updates: "Incident updates",
  assignment_updates: "Assignment / response updates",
  critical_only: "Critical alerts only",
};

export default function SettingsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [certifications, setCertifications] = useState<Certification[]>([]);

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [isOnDuty, setIsOnDuty] = useState(true);
  const [notifications, setNotifications] =
    useState<NotificationSettings>(defaultNotifications);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadSettings();
  }, []);

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
      alert(error?.message || "Could not load settings.");
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

  function toggleNotification(key: NotificationKey, channel: Channel) {
    setNotifications((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [channel]: !prev[key][channel],
      },
    }));
  }

  async function saveSettings() {
    if (!profile) return;

    if (!email.trim()) {
      alert("Email is required.");
      return;
    }

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

    if (error) {
      alert(error.message);
      return;
    }

    alert("Settings saved");
    await loadSettings();
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-black px-4 py-5 pb-28 text-white sm:p-6 sm:pb-28">
        Loading settings...
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

          <RoleSwitcher />
        </div>

        <div>
          <p className="text-sm text-gray-500">Matzil SAR</p>
          <h1 className="text-3xl font-bold">Settings</h1>
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

        <section className="rounded-xl bg-gray-900 p-5 space-y-4">
          <div>
            <div className="text-xl font-semibold">Notification Management</div>
            <div className="text-sm text-gray-400">
              Choose which channels you want for each alert type.
            </div>
          </div>

          {Object.entries(notificationLabels).map(([key, label]) => {
            const notificationKey = key as NotificationKey;

            return (
              <div key={key} className="rounded-lg bg-black/30 p-4">
                <div className="mb-3 font-medium">{label}</div>

                <div className="grid grid-cols-3 gap-2 text-sm">
                  {(["push", "sms", "email"] as Channel[]).map((channel) => (
                    <button
                      key={channel}
                      onClick={() => toggleNotification(notificationKey, channel)}
                      className={`rounded px-3 py-2 capitalize ${
                        notifications[notificationKey]?.[channel]
                          ? "bg-red-600"
                          : "bg-gray-700"
                      }`}
                    >
                      {channel}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
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
      </div>
    </main>
  );
}