"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentTestEmail, getStoredRole, UserRole } from "@/lib/dev-user";
import RoleSwitcher from "@/components/RoleSwitcher";

type Incident = {
  id: string;
  incident_number: string;
  title: string;
  type: string;
  short_description: string | null;
  status: string;
  accepting_units: boolean;
  staging_name: string | null;
  staging_lat: number | null;
  staging_lng: number | null;
  updated_at?: string | null;
};

type Snapshot = {
  title: string;
  type: string;
  short_description: string;
  status: string;
  accepting_units: boolean;
  staging_name: string;
  staging_lat: string;
  staging_lat_dir: "N" | "S";
  staging_lng: string;
  staging_lng_dir: "E" | "W";
};

export default function EditIncidentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [incidentId, setIncidentId] = useState<string | null>(null);
  const [incident, setIncident] = useState<Incident | null>(null);
  const [baselineUpdatedAt, setBaselineUpdatedAt] = useState<string | null>(null);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>("Member");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("Emergency Callout");
  const [status, setStatus] = useState("Pending");
  const [acceptingUnits, setAcceptingUnits] = useState(false);

  const [stagingName, setStagingName] = useState("");
  const [stagingLat, setStagingLat] = useState("");
  const [stagingLatDir, setStagingLatDir] = useState<"N" | "S">("N");
  const [stagingLng, setStagingLng] = useState("");
  const [stagingLngDir, setStagingLngDir] = useState<"E" | "W">("W");

  const [notifyMembers, setNotifyMembers] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function init() {
      const resolved = await params;
      setIncidentId(resolved.id);
    }
    void init();
  }, [params]);

  useEffect(() => {
    if (!incidentId) return;
    void loadPage();
  }, [incidentId]);

  async function loadPage() {
    const email = getCurrentTestEmail();
    const role = getStoredRole();
    setCurrentUserRole(role);

    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .single();

    if (user) {
      setCurrentUserId(user.id);
    }

    const { data, error } = await supabase
      .from("incidents")
      .select(`
        id,
        incident_number,
        title,
        type,
        short_description,
        status,
        accepting_units,
        staging_name,
        staging_lat,
        staging_lng,
        updated_at
      `)
      .eq("id", incidentId)
      .single();

    if (error || !data) {
      return;
    }

    const typed = data as Incident;
    setIncident(typed);
    setBaselineUpdatedAt(typed.updated_at ?? null);

    setTitle(typed.title ?? "");
    setDescription(typed.short_description ?? "");
    setType(typed.type ?? "Emergency Callout");
    setStatus(typed.status ?? "Pending");
    setAcceptingUnits(Boolean(typed.accepting_units));
    setStagingName(typed.staging_name ?? "");

    const lat = typed.staging_lat ?? 0;
    const lng = typed.staging_lng ?? 0;

    setStagingLat(Math.abs(lat).toString());
    setStagingLatDir(lat < 0 ? "S" : "N");

    setStagingLng(Math.abs(lng).toString());
    setStagingLngDir(lng < 0 ? "E" : "W");
  }

  function canEdit() {
    return (
      currentUserRole === "SAR Manager" ||
      currentUserRole === "Global Admin" ||
      currentUserRole === "Dispatcher"
    );
  }

  function buildSignedLatitude(value: number, dir: "N" | "S") {
    return dir === "S" ? -Math.abs(value) : Math.abs(value);
  }

  function buildSignedLongitude(value: number, dir: "E" | "W") {
    return dir === "W" ? -Math.abs(value) : Math.abs(value);
  }

  const originalSnapshot: Snapshot | null = useMemo(() => {
    if (!incident) return null;

    const lat = incident.staging_lat ?? 0;
    const lng = incident.staging_lng ?? 0;

    return {
      title: incident.title ?? "",
      type: incident.type ?? "",
      short_description: incident.short_description ?? "",
      status: incident.status ?? "",
      accepting_units: Boolean(incident.accepting_units),
      staging_name: incident.staging_name ?? "",
      staging_lat: Math.abs(lat).toString(),
      staging_lat_dir: lat < 0 ? "S" : "N",
      staging_lng: Math.abs(lng).toString(),
      staging_lng_dir: lng < 0 ? "E" : "W",
    };
  }, [incident]);

  const currentSnapshot: Snapshot = useMemo(
    () => ({
      title,
      type,
      short_description: description,
      status,
      accepting_units: acceptingUnits,
      staging_name: stagingName,
      staging_lat: stagingLat,
      staging_lat_dir: stagingLatDir,
      staging_lng: stagingLng,
      staging_lng_dir: stagingLngDir,
    }),
    [
      title,
      type,
      description,
      status,
      acceptingUnits,
      stagingName,
      stagingLat,
      stagingLatDir,
      stagingLng,
      stagingLngDir,
    ]
  );

  const changes = useMemo(() => {
    if (!originalSnapshot) return [];

    const rows: { label: string; from: string; to: string; key: string }[] = [];

    if (originalSnapshot.title !== currentSnapshot.title) {
      rows.push({
        key: "title",
        label: "Title",
        from: originalSnapshot.title || "—",
        to: currentSnapshot.title || "—",
      });
    }

    if (originalSnapshot.type !== currentSnapshot.type) {
      rows.push({
        key: "type",
        label: "Type",
        from: originalSnapshot.type || "—",
        to: currentSnapshot.type || "—",
      });
    }

    if (originalSnapshot.short_description !== currentSnapshot.short_description) {
      rows.push({
        key: "short_description",
        label: "Description",
        from: originalSnapshot.short_description || "—",
        to: currentSnapshot.short_description || "—",
      });
    }

    if (originalSnapshot.status !== currentSnapshot.status) {
      rows.push({
        key: "status",
        label: "Status",
        from: originalSnapshot.status || "—",
        to: currentSnapshot.status || "—",
      });
    }

    if (originalSnapshot.accepting_units !== currentSnapshot.accepting_units) {
      rows.push({
        key: "accepting_units",
        label: "Accepting Units",
        from: originalSnapshot.accepting_units ? "Yes" : "No",
        to: currentSnapshot.accepting_units ? "Yes" : "No",
      });
    }

    if (originalSnapshot.staging_name !== currentSnapshot.staging_name) {
      rows.push({
        key: "staging_name",
        label: "Staging Name",
        from: originalSnapshot.staging_name || "—",
        to: currentSnapshot.staging_name || "—",
      });
    }

    const fromLat = `${originalSnapshot.staging_lat} ${originalSnapshot.staging_lat_dir}`;
    const toLat = `${currentSnapshot.staging_lat} ${currentSnapshot.staging_lat_dir}`;
    if (fromLat !== toLat) {
      rows.push({
        key: "staging_lat",
        label: "Staging Latitude",
        from: fromLat,
        to: toLat,
      });
    }

    const fromLng = `${originalSnapshot.staging_lng} ${originalSnapshot.staging_lng_dir}`;
    const toLng = `${currentSnapshot.staging_lng} ${currentSnapshot.staging_lng_dir}`;
    if (fromLng !== toLng) {
      rows.push({
        key: "staging_lng",
        label: "Staging Longitude",
        from: fromLng,
        to: toLng,
      });
    }

    return rows;
  }, [originalSnapshot, currentSnapshot]);

  async function saveIncident() {
    if (!incidentId || !currentUserId || !incident) return;

    if (!canEdit()) {
      alert("You do not have permission to edit incidents.");
      return;
    }

    if (changes.length === 0) {
      alert("No changes made.");
      return;
    }

    if (!title.trim()) {
      alert("Title is required.");
      return;
    }

    if (!stagingName.trim()) {
      alert("Staging name is required.");
      return;
    }

    const latNumber = Number(stagingLat);
    const lngNumber = Number(stagingLng);

    if (Number.isNaN(latNumber) || Number.isNaN(lngNumber)) {
      alert("Latitude and longitude must be valid numbers.");
      return;
    }

    const finalLat = buildSignedLatitude(latNumber, stagingLatDir);
    const finalLng = buildSignedLongitude(lngNumber, stagingLngDir);

    setSaving(true);

    const { data: latestIncident, error: latestError } = await supabase
      .from("incidents")
      .select("updated_at")
      .eq("id", incidentId)
      .single();

    if (latestError) {
      setSaving(false);
      alert(`Error checking latest incident: ${latestError.message}`);
      return;
    }

    const latestUpdatedAt = latestIncident?.updated_at ?? null;

    if (
      baselineUpdatedAt &&
      latestUpdatedAt &&
      baselineUpdatedAt !== latestUpdatedAt
    ) {
      const override = window.confirm(
        "Another user made changes to this incident. Do you want to cancel your changes or override?"
      );

      if (!override) {
        setSaving(false);
        window.location.reload();
        return;
      }
    }

    const updatePayload: Record<string, any> = {};

    for (const change of changes) {
      if (change.key === "title") updatePayload.title = title.trim();
      if (change.key === "type") updatePayload.type = type;
      if (change.key === "short_description") {
        updatePayload.short_description = description.trim() || null;
      }
      if (change.key === "status") updatePayload.status = status;
      if (change.key === "accepting_units") {
        updatePayload.accepting_units = acceptingUnits;
      }
      if (change.key === "staging_name") {
        updatePayload.staging_name = stagingName.trim();
      }
      if (change.key === "staging_lat") updatePayload.staging_lat = finalLat;
      if (change.key === "staging_lng") updatePayload.staging_lng = finalLng;
    }

    const { error } = await supabase
      .from("incidents")
      .update(updatePayload)
      .eq("id", incidentId);

    if (error) {
      setSaving(false);
      alert(`Save error: ${error.message}`);
      return;
    }

    const summary = changes
      .map((change) => `${change.label}: ${change.from} → ${change.to}`)
      .join("\n");

    const updateTitleValue =
      changes.length === 1 ? `Edited ${changes[0].label}` : "Incident edited";

    const updateBodyValue =
      `${summary}${notifyMembers ? "\n\nNotify members: Yes" : ""}`;

    await supabase.from("incident_updates").insert({
      incident_id: incidentId,
      update_type: notifyMembers ? "Critical Edit" : "General Update",
      title: updateTitleValue,
      body: updateBodyValue,
      created_by: currentUserId,
    });

    setSaving(false);
    window.location.href = `/incidents/${incidentId}`;
  }

  if (!incident) {
    return (
      <main className="min-h-screen bg-black p-6 text-white">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="flex justify-between">
            <Link
              href="/incidents"
              className="rounded border border-gray-800 bg-gray-900 px-4 py-2"
            >
              Back
            </Link>
            <RoleSwitcher />
          </div>

          <div className="rounded-xl bg-gray-900 p-6 text-gray-400">
            Loading incident...
          </div>
        </div>
      </main>
    );
  }

  if (!canEdit()) {
    return (
      <main className="min-h-screen bg-black p-6 text-white">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="flex justify-between">
            <Link
              href={`/incidents/${incident.id}`}
              className="rounded border border-gray-800 bg-gray-900 px-4 py-2"
            >
              Back
            </Link>
            <RoleSwitcher />
          </div>

          <div className="rounded-xl bg-gray-900 p-6 text-red-300">
            You do not have permission to edit incidents.
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex justify-between">
          <Link
            href={`/incidents/${incident.id}`}
            className="rounded border border-gray-800 bg-gray-900 px-4 py-2"
          >
            Back
          </Link>
          <RoleSwitcher />
        </div>

        <div className="rounded-xl bg-gray-900 p-6 space-y-4">
          <div>
            <h1 className="text-3xl font-bold">Edit Incident</h1>
            <div className="mt-2 text-sm text-gray-400">
              {incident.incident_number}
            </div>
          </div>

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Incident Title"
            className="w-full rounded bg-black px-3 py-2"
          />

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            className="w-full rounded bg-black px-3 py-2"
            rows={4}
          />

          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full rounded bg-black px-3 py-2"
          >
            <option>Emergency Callout</option>
            <option>Deployment</option>
          </select>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded bg-black px-3 py-2"
          >
            <option>Pending</option>
            <option>Active</option>
            <option>Closed</option>
          </select>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={acceptingUnits}
              onChange={(e) => setAcceptingUnits(e.target.checked)}
            />
            <span>Accepting Units</span>
          </label>

          <input
            value={stagingName}
            onChange={(e) => setStagingName(e.target.value)}
            placeholder="Staging Name"
            className="w-full rounded bg-black px-3 py-2"
          />

          <div className="grid grid-cols-2 gap-3">
            <input
              value={stagingLat}
              onChange={(e) => setStagingLat(e.target.value)}
              placeholder="Latitude"
              className="w-full rounded bg-black px-3 py-2"
            />
            <select
              value={stagingLatDir}
              onChange={(e) => setStagingLatDir(e.target.value as "N" | "S")}
              className="w-full rounded bg-black px-3 py-2"
            >
              <option value="N">N</option>
              <option value="S">S</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input
              value={stagingLng}
              onChange={(e) => setStagingLng(e.target.value)}
              placeholder="Longitude"
              className="w-full rounded bg-black px-3 py-2"
            />
            <select
              value={stagingLngDir}
              onChange={(e) => setStagingLngDir(e.target.value as "E" | "W")}
              className="w-full rounded bg-black px-3 py-2"
            >
              <option value="W">W</option>
              <option value="E">E</option>
            </select>
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={notifyMembers}
              onChange={(e) => setNotifyMembers(e.target.checked)}
            />
            <span>Notify members?</span>
          </label>
        </div>

        <div className="rounded-xl bg-gray-900 p-6 space-y-3">
          <div className="text-xl font-semibold">Changes Preview</div>

          {changes.length === 0 ? (
            <div className="text-gray-400">No changes yet.</div>
          ) : (
            changes.map((change) => (
              <div
                key={change.key}
                className="rounded bg-black/30 px-4 py-3 text-sm"
              >
                <div className="font-medium">{change.label}</div>
                <div className="mt-1 text-gray-400">
                  {change.from} → {change.to}
                </div>
              </div>
            ))
          )}

          <button
            onClick={() => void saveIncident()}
            disabled={saving}
            className="w-full rounded bg-red-600 px-4 py-2"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </main>
  );
}