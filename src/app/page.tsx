"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Response = {
  response_type: string;
};

type Incident = {
  id: string;
  status: string;
  incident_responses: Response[];
};

export default function HomePage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel("dashboard-live-home")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "incident_responses" },
        () => {
          void loadData();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "incidents" },
        () => {
          void loadData();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  async function loadData() {
    const { data } = await supabase
      .from("incidents")
      .select(`
        id,
        status,
        incident_responses (
          response_type
        )
      `);

    if (data) setIncidents(data as Incident[]);
  }

  const activeIncidents = incidents.filter((i) => i.status === "Active").length;

  let responding = 0;
  let notAvailable = 0;
  let availableAt = 0;

  incidents.forEach((incident) => {
    incident.incident_responses.forEach((r) => {
      if (r.response_type === "Responding") responding++;
      if (r.response_type === "Not Available") notAvailable++;
      if (r.response_type === "Available At") availableAt++;
    });
  });

  const totalResponses = responding + notAvailable + availableAt;

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <p className="text-sm text-gray-500 mb-1">Matzil SAR</p>
            <h1 className="text-3xl font-bold">Operational Dashboard</h1>
          </div>

          <Link
            href="/incidents"
            className="bg-gray-900 px-4 py-2 rounded-lg border border-gray-800"
          >
            Incidents
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <Link
            href="/incidents"
            className="bg-gray-950 border border-gray-800 p-6 rounded-2xl hover:bg-gray-900 transition"
          >
            <div className="text-gray-400 text-sm">Active Incidents</div>
            <div className="text-3xl font-bold mt-2 text-red-400">
              {activeIncidents}
            </div>
          </Link>

          <div className="bg-gray-950 border border-gray-800 p-6 rounded-2xl">
            <div className="text-gray-400 text-sm">Total Responses</div>
            <div className="text-3xl font-bold mt-2">
              {totalResponses}
            </div>
          </div>

          <div className="bg-gray-950 border border-gray-800 p-6 rounded-2xl">
            <div className="text-gray-400 text-sm">Responding</div>
            <div className="text-3xl font-bold mt-2 text-green-400">
              {responding}
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-gray-950 border border-gray-800 p-6 rounded-2xl">
            <h2 className="text-xl font-semibold mb-4">
              Response Breakdown
            </h2>

            <div className="space-y-3">
              <div className="flex justify-between">
                <span>Responding</span>
                <span className="text-green-400">{responding}</span>
              </div>

              <div className="flex justify-between">
                <span>Available At</span>
                <span className="text-blue-400">{availableAt}</span>
              </div>

              <div className="flex justify-between">
                <span>Not Available</span>
                <span className="text-gray-400">{notAvailable}</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-950 border border-gray-800 p-6 rounded-2xl">
            <h2 className="text-xl font-semibold mb-4">
              System Status
            </h2>

            <p className="text-gray-400">
              Live incident tracking is active. Tap Active Incidents to open the incident list.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}