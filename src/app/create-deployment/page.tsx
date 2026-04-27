"use client";

import Link from "next/link";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import RoleSwitcher from "@/components/RoleSwitcher";
import { getCurrentTestEmail } from "@/lib/dev-user";

export default function CreateDeploymentPage() {
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [commanderCallSign, setCommanderCallSign] = useState("");

  const [waterNeeded, setWaterNeeded] = useState("");
  const [wildernessNeeded, setWildernessNeeded] = useState("");
  const [mruNeeded, setMruNeeded] = useState("");
  const [supportNeeded, setSupportNeeded] = useState("");

  const [creating, setCreating] = useState(false);

  function buildTeamNeeds() {
    return {
      Water: Number(waterNeeded || 0),
      Wilderness: Number(wildernessNeeded || 0),
      MRU: Number(mruNeeded || 0),
      Support: Number(supportNeeded || 0),
    };
  }

  async function createDeployment() {
    if (!title.trim()) {
      alert("Title required");
      return;
    }

    setCreating(true);

    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("email", getCurrentTestEmail())
      .single();

    const now = new Date();
    const deploymentNumber = `DEP-${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}-${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0")}`;

    const { error } = await supabase.from("incidents").insert({
      title: title.trim(),
      incident_number: deploymentNumber,
      type: "Deployment",
      status: "Active",
      staging_name: location.trim() || "Deployment Location",
      incident_commander_call_sign:
        commanderCallSign.trim() || null,
      team_needs: buildTeamNeeds(),
      created_by: user?.id ?? null,
    });

    setCreating(false);

    if (error) {
      alert(error.message);
      return;
    }

    window.location.href = "/";
  }

  return (
    <main className="min-h-screen bg-black px-4 py-5 pb-28 text-white sm:p-6 sm:pb-28">
      <div className="mx-auto max-w-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            href="/"
            className="rounded border border-gray-800 bg-gray-900 px-4 py-2 text-sm"
          >
            Back
          </Link>

          <RoleSwitcher />
        </div>

        <div>
          <p className="text-sm text-gray-500">Matzil SAR</p>
          <h1 className="text-3xl font-bold">Create Deployment</h1>
        </div>

        <div className="space-y-3 rounded-xl bg-gray-900 p-5">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Deployment title"
            className="w-full rounded bg-black px-4 py-3"
          />

          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Deployment location"
            className="w-full rounded bg-black px-4 py-3"
          />

          <input
            value={commanderCallSign}
            onChange={(e) => setCommanderCallSign(e.target.value)}
            placeholder="Incident Commander call sign"
            className="w-full rounded bg-black px-4 py-3"
          />

          <div className="rounded-lg bg-black/30 p-4">
            <div className="mb-3 font-semibold">Team Members Needed</div>

            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={waterNeeded}
                onChange={(e) => setWaterNeeded(e.target.value)}
                type="number"
                min="0"
                placeholder="Water"
                className="w-full rounded bg-black px-4 py-3"
              />

              <input
                value={wildernessNeeded}
                onChange={(e) => setWildernessNeeded(e.target.value)}
                type="number"
                min="0"
                placeholder="Wilderness"
                className="w-full rounded bg-black px-4 py-3"
              />

              <input
                value={mruNeeded}
                onChange={(e) => setMruNeeded(e.target.value)}
                type="number"
                min="0"
                placeholder="MRU"
                className="w-full rounded bg-black px-4 py-3"
              />

              <input
                value={supportNeeded}
                onChange={(e) => setSupportNeeded(e.target.value)}
                type="number"
                min="0"
                placeholder="Support"
                className="w-full rounded bg-black px-4 py-3"
              />
            </div>
          </div>

          <button
            onClick={() => void createDeployment()}
            disabled={creating}
            className="w-full rounded bg-blue-600 px-4 py-3 font-medium disabled:opacity-60"
          >
            {creating ? "Creating..." : "Create Deployment"}
          </button>
        </div>
      </div>
    </main>
  );
}