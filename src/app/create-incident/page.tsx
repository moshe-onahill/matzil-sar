"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function CreateIncidentPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("Emergency Callout");
  const [loading, setLoading] = useState(false);

  async function createIncident() {
    if (!title) {
      alert("Title is required");
      return;
    }

    setLoading(true);

    // Generate incident number
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");

    const { count } = await supabase
      .from("incidents")
      .select("*", { count: "exact", head: true });

    const incidentNumber = `SAR-${year}-${month}-${(count || 0) + 1}`;

    const { error } = await supabase.from("incidents").insert({
      incident_number: incidentNumber,
      title,
      short_description: description,
      type,
      status: "Pending",
    });

    setLoading(false);

    if (error) {
      alert(`Error: ${error.message}`);
      return;
    }

    alert("Incident created (Pending approval)");
    setTitle("");
    setDescription("");
  }

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="max-w-xl mx-auto">
        <div className="flex justify-between mb-8">
          <h1 className="text-3xl font-bold">Create Incident</h1>

          <Link
            href="/"
            className="bg-gray-900 px-4 py-2 rounded-lg border border-gray-800"
          >
            Home
          </Link>
        </div>

        <div className="space-y-4">
          <input
            placeholder="Incident Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full p-3 rounded-xl bg-gray-900 border border-gray-800"
          />

          <textarea
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-3 rounded-xl bg-gray-900 border border-gray-800"
          />

          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full p-3 rounded-xl bg-gray-900 border border-gray-800"
          >
            <option>Emergency Callout</option>
            <option>Deployment</option>
          </select>

          <button
            onClick={createIncident}
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 p-3 rounded-xl"
          >
            {loading ? "Creating..." : "Create Incident"}
          </button>
        </div>
      </div>
    </main>
  );
}