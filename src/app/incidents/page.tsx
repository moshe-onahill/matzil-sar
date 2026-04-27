"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getStoredRole, UserRole } from "@/lib/dev-user";
import RoleSwitcher from "@/components/RoleSwitcher";

type Incident = {
  id: string;
  incident_number: string;
  title: string;
  type: string;
  short_description: string | null;
  status: string;
  accepting_units: boolean;
};

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>("Member");

  useEffect(() => {
    setCurrentUserRole(getStoredRole());
    void loadPageData();

    const channel = supabase
      .channel("incidents-list-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "incidents" },
        () => void loadPageData()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  async function loadPageData() {
    const role = getStoredRole();
    setCurrentUserRole(role);

    let query = supabase
      .from("incidents")
      .select(`
        id,
        incident_number,
        title,
        type,
        short_description,
        status,
        accepting_units
      `)
      .order("created_at", { ascending: false });

    if (role === "Member") {
      query = query.in("status", ["Active", "Closed"]);
    }

    const { data, error } = await query;

    if (error) {
      console.log("Incident query failed", error);
      return;
    }

    setIncidents((data as Incident[]) ?? []);
  }

  function getStatusColor(status: string) {
    if (status === "Active") return "text-red-400";
    if (status === "Pending") return "text-yellow-400";
    if (status === "Closed") return "text-gray-400";
    return "text-white";
  }

  const canCreate =
    currentUserRole === "SAR Manager" ||
    currentUserRole === "Global Admin" ||
    currentUserRole === "Dispatcher";

  return (
    <main className="min-h-screen bg-black px-4 py-5 text-white sm:p-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="space-y-3">
          <div>
            <p className="text-sm text-gray-500">Matzil SAR</p>
            <h1 className="text-4xl font-bold leading-tight sm:text-3xl">
              Incidents
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <RoleSwitcher />

            {canCreate && (
              <Link
                href="/create-incident"
                className="rounded bg-red-600 px-4 py-2 text-sm font-medium hover:bg-red-700"
              >
                Create Incident
              </Link>
            )}

            <Link
              href="/"
              className="rounded border border-gray-800 bg-gray-900 px-4 py-2 text-sm hover:bg-gray-800"
            >
              Dashboard
            </Link>
          </div>
        </div>

        <div className="text-sm text-gray-400">
          Current Role: {currentUserRole}
        </div>

        <div className="space-y-3">
          {incidents.length === 0 && (
            <div className="rounded-xl bg-gray-900 p-5 text-gray-400">
              No incidents found.
            </div>
          )}

          {incidents.map((incident) => (
            <Link
              key={incident.id}
              href={`/incidents/${incident.id}`}
              className="block rounded-xl bg-gray-900 p-5 transition hover:bg-gray-800"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                <div className="min-w-0">
                  <div className="text-sm text-gray-400">
                    {incident.incident_number}
                  </div>
                  <div className="mt-1 break-words text-2xl font-medium sm:text-xl">
                    {incident.title}
                  </div>
                  {incident.short_description && (
                    <div className="mt-2 text-base text-gray-400 sm:text-sm">
                      {incident.short_description}
                    </div>
                  )}
                </div>

                <div className="shrink-0 text-left text-sm sm:text-right">
                  <div>{incident.type}</div>
                  <div className={getStatusColor(incident.status)}>
                    {incident.status}
                  </div>
                  {!incident.accepting_units &&
                    incident.status === "Active" && (
                      <div className="mt-1 text-orange-400">
                        No more units
                      </div>
                    )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}