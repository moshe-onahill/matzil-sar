"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getCurrentTestEmail, getStoredRole, UserRole } from "@/lib/dev-user";
import RoleSwitcher from "@/components/RoleSwitcher";

export default function CreateIncidentPage() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>("Member");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("Emergency Callout");

  const [stagingName, setStagingName] = useState("");
  const [stagingLat, setStagingLat] = useState("");
  const [stagingLatDir, setStagingLatDir] = useState<"N" | "S">("N");
  const [stagingLng, setStagingLng] = useState("");
  const [stagingLngDir, setStagingLngDir] = useState<"E" | "W">("W");

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void loadUser();
  }, []);

  async function loadUser() {
    setCurrentUserRole(getStoredRole());

    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("email", getCurrentTestEmail())
      .single();

    if (user) {
      setCurrentUserId(user.id);
    }
  }

  function buildSignedLatitude(value: number, dir: "N" | "S") {
    return dir === "S" ? -Math.abs(value) : Math.abs(value);
  }

  function buildSignedLongitude(value: number, dir: "E" | "W") {
    return dir === "W" ? -Math.abs(value) : Math.abs(value);
  }

  async function createIncident() {
    if (!currentUserId) return;

    if (
      currentUserRole !== "SAR Manager" &&
      currentUserRole !== "Global Admin"
    ) {
      alert("You do not have permission to create incidents.");
      return;
    }

    if (!title.trim()) {
      alert("Title is required");
      return;
    }

    if (!stagingName.trim()) {
      alert("Staging name is required");
      return;
    }

    if (!stagingLat.trim() || !stagingLng.trim()) {
      alert("Staging latitude and longitude are required");
      return;
    }

    const latNumber = Number(stagingLat);
    const lngNumber = Number(stagingLng);

    if (Number.isNaN(latNumber) || Number.isNaN(lngNumber)) {
      alert("Latitude and longitude must be valid numbers");
      return;
    }

    const finalLat = buildSignedLatitude(latNumber, stagingLatDir);
    const finalLng = buildSignedLongitude(lngNumber, stagingLngDir);

    setLoading(true);

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");

    const { count } = await supabase
      .from("incidents")
      .select("*", { count: "exact", head: true });

    const incidentNumber = `SAR-${year}-${month}-${String(
      (count || 0) + 1
    ).padStart(3, "0")}`;

    const isManager = currentUserRole === "SAR Manager";

    const { error } = await supabase.from("incidents").insert({
      incident_number: incidentNumber,
      title: title.trim(),
      short_description: description.trim() || null,
      type,
      status: isManager ? "Active" : "Pending",
      accepting_units: isManager,
      created_by: currentUserId,
      staging_name: stagingName.trim(),
      staging_lat: finalLat,
      staging_lng: finalLng,
    });

    setLoading(false);

    if (error) {
      alert(`Error: ${error.message}`);
      return;
    }

    window.location.href = "/incidents";
  }

  if (
    currentUserRole !== "SAR Manager" &&
    currentUserRole !== "Global Admin"
  ) {
    return (
      <main className="min-h-screen bg-black p-6 text-white">
        <div className="mx-auto max-w-xl space-y-4">
          <div className="flex justify-between">
            <Link
              href="/incidents"
              className="rounded border border-gray-800 bg-gray-900 px-4 py-2"
            >
              Back
            </Link>
            <RoleSwitcher />
          </div>

          <div className="rounded-xl bg-gray-900 p-6 text-red-300">
            You do not have permission to create incidents.
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto max-w-xl space-y-4">
        <div className="flex justify-between">
          <Link
            href="/incidents"
            className="rounded border border-gray-800 bg-gray-900 px-4 py-2"
          >
            Back
          </Link>
          <RoleSwitcher />
        </div>

        <div className="rounded-xl bg-gray-900 p-6 space-y-4">
          <div>
            <h1 className="text-3xl font-bold">Create Incident</h1>
            <div className="mt-2 text-sm text-gray-400">
              Current Role: {currentUserRole}
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

          <div className="text-sm text-gray-400">
            Example for New Jersey: latitude 40.x with N, longitude 74.x with W
          </div>

          <button
            onClick={() => void createIncident()}
            disabled={loading}
            className="w-full rounded bg-red-600 px-4 py-2"
          >
            {loading ? "Creating..." : "Create Incident"}
          </button>
        </div>
      </div>
    </main>
  );
}