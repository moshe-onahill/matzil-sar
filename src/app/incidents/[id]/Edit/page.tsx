"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
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
  staging_address: string | null;
  staging_lat: number | null;
  staging_lng: number | null;
  team_needs: Record<string, number> | null;
  updated_at?: string | null;
};

type Snapshot = {
  title: string;
  type: string;
  short_description: string;
  status: string;
  accepting_units: boolean;
  staging_name: string;
  staging_address: string;
  staging_lat: string;
  staging_lat_dir: "N" | "S";
  staging_lng: string;
  staging_lng_dir: "E" | "W";
  water_needed: string;
  wilderness_needed: string;
  mru_needed: string;
  support_needed: string;
};

export default function EditIncidentPage() {
  const params = useParams<{ id: string }>();

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
  const [stagingAddress, setStagingAddress] = useState("");
  const [stagingLat, setStagingLat] = useState("");
  const [stagingLatDir, setStagingLatDir] = useState<"N" | "S">("N");
  const [stagingLng, setStagingLng] = useState("");
  const [stagingLngDir, setStagingLngDir] = useState<"E" | "W">("W");

  const [waterNeeded, setWaterNeeded] = useState("");
  const [wildernessNeeded, setWildernessNeeded] = useState("");
  const [mruNeeded, setMruNeeded] = useState("");
  const [supportNeeded, setSupportNeeded] = useState("");

  const [notifyMembers, setNotifyMembers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    if (params?.id) setIncidentId(params.id);
  }, [params]);

  useEffect(() => {
    if (!incidentId) return;
    void loadPage();
  }, [incidentId]);

  async function loadPage() {
    if (!incidentId) return;

    setLoading(true);
    setPageError(null);

    const role = getStoredRole();
    setCurrentUserRole(role);

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("email", getCurrentTestEmail())
      .single();

    if (userError || !user) {
      setLoading(false);
      setPageError("Could not load current user.");
      return;
    }

    setCurrentUserId(user.id);

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
        staging_address,
        staging_lat,
        staging_lng,
        team_needs,
        updated_at
      `)
      .eq("id", incidentId)
      .single();

    if (error || !data) {
      setLoading(false);
      setPageError(error?.message || "Incident not found.");
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
    setStagingAddress(typed.staging_address ?? "");

    const lat = typed.staging_lat ?? 0;
    const lng = typed.staging_lng ?? 0;

    setStagingLat(lat ? Math.abs(lat).toString() : "");
    setStagingLatDir(lat < 0 ? "S" : "N");

    setStagingLng(lng ? Math.abs(lng).toString() : "");
    setStagingLngDir(lng < 0 ? "W" : "E");

    setWaterNeeded(String(typed.team_needs?.Water ?? ""));
    setWildernessNeeded(String(typed.team_needs?.Wilderness ?? ""));
    setMruNeeded(String(typed.team_needs?.MRU ?? ""));
    setSupportNeeded(String(typed.team_needs?.Support ?? ""));

    setLoading(false);
  }

  function canEdit() {
    return (
      currentUserRole === "SAR Manager" ||
      currentUserRole === "Global Admin" ||
      currentUserRole === "Dispatcher"
    );
  }

  function buildTeamNeeds() {
    return {
      Water: Number(waterNeeded || 0),
      Wilderness: Number(wildernessNeeded || 0),
      MRU: Number(mruNeeded || 0),
      Support: Number(supportNeeded || 0),
    };
  }

  function buildSignedLatitude(value: number, dir: "N" | "S") {
    return dir === "S" ? -Math.abs(value) : Math.abs(value);
  }

  function buildSignedLongitude(value: number, dir: "E" | "W") {
    return dir === "W" ? -Math.abs(value) : Math.abs(value);
  }

  function applyCoordinateValues(lat: number, lng: number) {
    setStagingLat(Math.abs(lat).toString());
    setStagingLatDir(lat < 0 ? "S" : "N");
    setStagingLng(Math.abs(lng).toString());
    setStagingLngDir(lng < 0 ? "W" : "E");
  }

  async function geocodeAddress() {
    if (!stagingAddress.trim()) {
      alert("Enter an address first.");
      return;
    }

    setGeocoding(true);

    try {
      const encoded = encodeURIComponent(stagingAddress.trim());
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encoded}`;

      const response = await fetch(url, {
        headers: { Accept: "application/json" },
      });

      const data = await response.json();

      if (!Array.isArray(data) || data.length === 0) {
        alert("Address not found.");
        setGeocoding(false);
        return;
      }

      const lat = Number(data[0].lat);
      const lng = Number(data[0].lon);

      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        alert("Could not parse coordinates.");
        setGeocoding(false);
        return;
      }

      applyCoordinateValues(lat, lng);
    } catch {
      alert("Geocoding failed.");
    }

    setGeocoding(false);
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
      staging_address: incident.staging_address ?? "",
      staging_lat: lat ? Math.abs(lat).toString() : "",
      staging_lat_dir: lat < 0 ? "S" : "N",
      staging_lng: lng ? Math.abs(lng).toString() : "",
      staging_lng_dir: lng < 0 ? "W" : "E",
      water_needed: String(incident.team_needs?.Water ?? ""),
      wilderness_needed: String(incident.team_needs?.Wilderness ?? ""),
      mru_needed: String(incident.team_needs?.MRU ?? ""),
      support_needed: String(incident.team_needs?.Support ?? ""),
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
      staging_address: stagingAddress,
      staging_lat: stagingLat,
      staging_lat_dir: stagingLatDir,
      staging_lng: stagingLng,
      staging_lng_dir: stagingLngDir,
      water_needed: waterNeeded,
      wilderness_needed: wildernessNeeded,
      mru_needed: mruNeeded,
      support_needed: supportNeeded,
    }),
    [
      title,
      type,
      description,
      status,
      acceptingUnits,
      stagingName,
      stagingAddress,
      stagingLat,
      stagingLatDir,
      stagingLng,
      stagingLngDir,
      waterNeeded,
      wildernessNeeded,
      mruNeeded,
      supportNeeded,
    ]
  );

  const changes = useMemo(() => {
    if (!originalSnapshot) return [];

    const rows: { label: string; from: string; to: string; key: string }[] = [];

    function pushChange(key: string, label: string, from: string, to: string) {
      if (from !== to) {
        rows.push({ key, label, from: from || "—", to: to || "—" });
      }
    }

    pushChange("title", "Title", originalSnapshot.title, currentSnapshot.title);
    pushChange("type", "Type", originalSnapshot.type, currentSnapshot.type);
    pushChange(
      "short_description",
      "Description",
      originalSnapshot.short_description,
      currentSnapshot.short_description
    );
    pushChange("status", "Status", originalSnapshot.status, currentSnapshot.status);

    if (originalSnapshot.accepting_units !== currentSnapshot.accepting_units) {
      rows.push({
        key: "accepting_units",
        label: "Accepting Units",
        from: originalSnapshot.accepting_units ? "Yes" : "No",
        to: currentSnapshot.accepting_units ? "Yes" : "No",
      });
    }

    pushChange(
      "staging_name",
      "Staging Name",
      originalSnapshot.staging_name,
      currentSnapshot.staging_name
    );
    pushChange(
      "staging_address",
      "Staging Address",
      originalSnapshot.staging_address,
      currentSnapshot.staging_address
    );

    pushChange(
      "staging_lat",
      "Staging Latitude",
      `${originalSnapshot.staging_lat} ${originalSnapshot.staging_lat_dir}`.trim(),
      `${currentSnapshot.staging_lat} ${currentSnapshot.staging_lat_dir}`.trim()
    );

    pushChange(
      "staging_lng",
      "Staging Longitude",
      `${originalSnapshot.staging_lng} ${originalSnapshot.staging_lng_dir}`.trim(),
      `${currentSnapshot.staging_lng} ${currentSnapshot.staging_lng_dir}`.trim()
    );

    pushChange(
      "team_needs",
      "Team Needs",
      `Water ${originalSnapshot.water_needed || 0}, Wilderness ${
        originalSnapshot.wilderness_needed || 0
      }, MRU ${originalSnapshot.mru_needed || 0}, Support ${
        originalSnapshot.support_needed || 0
      }`,
      `Water ${currentSnapshot.water_needed || 0}, Wilderness ${
        currentSnapshot.wilderness_needed || 0
      }, MRU ${currentSnapshot.mru_needed || 0}, Support ${
        currentSnapshot.support_needed || 0
      }`
    );

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

    if (!stagingLat.trim() || !stagingLng.trim()) {
      alert("Latitude and longitude are required.");
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

    if (baselineUpdatedAt && latestUpdatedAt && baselineUpdatedAt !== latestUpdatedAt) {
      const override = window.confirm(
        "Another user made these changes, do you want to cancel your changes or override?"
      );

      if (!override) {
        setSaving(false);
        window.location.reload();
        return;
      }
    }

    const { error } = await supabase
      .from("incidents")
      .update({
        title: title.trim(),
        type,
        short_description: description.trim() || null,
        status,
        accepting_units: acceptingUnits,
        staging_name: stagingName.trim(),
        staging_address: stagingAddress.trim() || null,
        staging_lat: finalLat,
        staging_lng: finalLng,
        team_needs: buildTeamNeeds(),
      })
      .eq("id", incidentId);

    if (error) {
      setSaving(false);
      alert(`Save error: ${error.message}`);
      return;
    }

    const summary = changes
      .map((change) => `${change.label}: ${change.from} → ${change.to}`)
      .join("\n");

    await supabase.from("incident_updates").insert({
      incident_id: incidentId,
      update_type: notifyMembers ? "Critical Edit" : "General Update",
      title: changes.length === 1 ? `Edited ${changes[0].label}` : "Incident edited",
      body: `${summary}${notifyMembers ? "\n\nNotify members: Yes" : ""}`,
      created_by: currentUserId,
    });

    setSaving(false);
    window.location.href = `/incidents/${incidentId}`;
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black p-6 text-white">
        Loading incident...
      </main>
    );
  }

  if (pageError) {
    return (
      <main className="min-h-screen bg-black p-6 text-red-300">
        {pageError}
      </main>
    );
  }

  if (!incident) return null;

  if (!canEdit()) {
    return (
      <main className="min-h-screen bg-black p-6 text-white">
        <div className="mx-auto max-w-3xl space-y-4">
          <Link href={`/incidents/${incident.id}`} className="rounded bg-gray-900 px-4 py-2">
            Back
          </Link>
          <div className="rounded-xl bg-gray-900 p-6 text-red-300">
            You do not have permission to edit incidents.
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-5 pb-28 text-white sm:p-6 sm:pb-28">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex flex-wrap justify-between gap-2">
          <Link href={`/incidents/${incident.id}`} className="rounded bg-gray-900 px-4 py-2">
            Back
          </Link>
          <RoleSwitcher />
        </div>

        <div className="rounded-xl bg-gray-900 p-5 space-y-4">
          <h1 className="text-3xl font-bold">Edit Incident</h1>
          <div className="text-sm text-gray-400">{incident.incident_number}</div>

          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded bg-black px-3 py-3" />

          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="w-full rounded bg-black px-3 py-3" />

          <select value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded bg-black px-3 py-3">
            <option>Emergency Callout</option>
            <option>Deployment</option>
          </select>

          <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full rounded bg-black px-3 py-3">
            <option>Pending</option>
            <option>Active</option>
            <option>Closed</option>
          </select>

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={acceptingUnits} onChange={(e) => setAcceptingUnits(e.target.checked)} />
            <span>Accepting Units</span>
          </label>

          <div className="rounded-lg bg-black/30 p-4">
            <div className="mb-3 font-semibold">Team Members Needed</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input value={waterNeeded} onChange={(e) => setWaterNeeded(e.target.value)} type="number" min="0" placeholder="Water" className="rounded bg-black px-4 py-3" />
              <input value={wildernessNeeded} onChange={(e) => setWildernessNeeded(e.target.value)} type="number" min="0" placeholder="Wilderness" className="rounded bg-black px-4 py-3" />
              <input value={mruNeeded} onChange={(e) => setMruNeeded(e.target.value)} type="number" min="0" placeholder="MRU" className="rounded bg-black px-4 py-3" />
              <input value={supportNeeded} onChange={(e) => setSupportNeeded(e.target.value)} type="number" min="0" placeholder="Support" className="rounded bg-black px-4 py-3" />
            </div>
          </div>

          <input value={stagingName} onChange={(e) => setStagingName(e.target.value)} placeholder="Staging Name" className="w-full rounded bg-black px-3 py-3" />

          <input value={stagingAddress} onChange={(e) => setStagingAddress(e.target.value)} placeholder="Address" className="w-full rounded bg-black px-3 py-3" />

          <button onClick={() => void geocodeAddress()} disabled={geocoding} className="rounded bg-blue-600 px-4 py-2">
            {geocoding ? "Getting Coordinates..." : "Get Coordinates"}
          </button>

          <div className="grid grid-cols-2 gap-3">
            <input value={stagingLat} onChange={(e) => setStagingLat(e.target.value)} placeholder="Latitude" className="rounded bg-black px-3 py-3" />
            <select value={stagingLatDir} onChange={(e) => setStagingLatDir(e.target.value as "N" | "S")} className="rounded bg-black px-3 py-3">
              <option value="N">N</option>
              <option value="S">S</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input value={stagingLng} onChange={(e) => setStagingLng(e.target.value)} placeholder="Longitude" className="rounded bg-black px-3 py-3" />
            <select value={stagingLngDir} onChange={(e) => setStagingLngDir(e.target.value as "E" | "W")} className="rounded bg-black px-3 py-3">
              <option value="W">W</option>
              <option value="E">E</option>
            </select>
          </div>

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={notifyMembers} onChange={(e) => setNotifyMembers(e.target.checked)} />
            <span>Notify members?</span>
          </label>
        </div>

        <div className="rounded-xl bg-gray-900 p-5 space-y-3">
          <div className="text-xl font-semibold">Changes Preview</div>

          {changes.length === 0 ? (
            <div className="text-gray-400">No changes yet.</div>
          ) : (
            changes.map((change) => (
              <div key={change.key} className="rounded bg-black/30 px-4 py-3 text-sm">
                <div className="font-medium">{change.label}</div>
                <div className="mt-1 text-gray-400">
                  {change.from} → {change.to}
                </div>
              </div>
            ))
          )}

          <button onClick={() => void saveIncident()} disabled={saving} className="w-full rounded bg-red-600 px-4 py-3">
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </main>
  );
}