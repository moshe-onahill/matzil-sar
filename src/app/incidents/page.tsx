"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  staging_name: string | null;
  staging_address: string | null;
  created_at: string;
  incident_responses: {
    user_id: string;
    response_type: string;
  }[];
};

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>("Member");
  const [closedOpen, setClosedOpen] = useState(false);

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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "incident_responses" },
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
        accepting_units,
        staging_name,
        staging_address,
        created_at,
        incident_responses (
          user_id,
          response_type
        )
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

    setIncidents((data as unknown as Incident[]) ?? []);
  }

  function responderCount(incident: Incident) {
    return (
      incident.incident_responses?.filter(
        (r) =>
          r.response_type !== "Cancelled" &&
          r.response_type !== "Not Available"
      ).length ?? 0
    );
  }

  function formatDateTime(date: string) {
    return new Date(date).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function statusClass(status: string) {
    if (status === "Active") return "text-red-400";
    if (status === "Pending") return "text-yellow-400";
    if (status === "Closed") return "text-gray-500";
    return "text-white";
  }

  const activeIncidents = useMemo(
    () => incidents.filter((i) => i.status === "Active"),
    [incidents]
  );

  const pendingIncidents = useMemo(
    () => incidents.filter((i) => i.status === "Pending"),
    [incidents]
  );

  const closedIncidents = useMemo(
    () => incidents.filter((i) => i.status === "Closed"),
    [incidents]
  );

  const canCreate =
    currentUserRole === "SAR Manager" ||
    currentUserRole === "Global Admin" ||
    currentUserRole === "Dispatcher";

  function IncidentCard({ incident }: { incident: Incident }) {
    return (
      <Link
        href={`/incidents/${incident.id}`}
        className={`block rounded-xl p-4 transition ${
          incident.status === "Closed"
            ? "bg-gray-950 hover:bg-gray-900"
            : "bg-gray-900 hover:bg-gray-800"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="break-words text-lg font-semibold leading-tight">
              {incident.title}
            </div>

            <div className="mt-1 text-xs text-gray-500">
              {incident.incident_number} • {incident.type}
            </div>

            <div className="mt-2 break-words text-sm text-gray-400">
              {incident.staging_name ||
                incident.staging_address ||
                "No location listed"}
            </div>

            <div className="mt-2 text-xs text-gray-500">
              Created {formatDateTime(incident.created_at)}
            </div>
          </div>

          <div className="shrink-0 text-right text-sm">
            <div className={statusClass(incident.status)}>
              {incident.status}
            </div>

            <div className="mt-2 text-gray-300">
              👤 {responderCount(incident)}
            </div>

            {!incident.accepting_units && incident.status === "Active" && (
              <div className="mt-1 text-xs text-orange-400">
                No more units
              </div>
            )}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-5 pb-28 text-white sm:p-6 sm:pb-28">
      <div className="mx-auto max-w-5xl space-y-5">
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

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-red-300">
              Active Incidents
            </h2>
            <span className="rounded bg-red-950/40 px-2 py-1 text-xs text-red-200">
              {activeIncidents.length}
            </span>
          </div>

          {activeIncidents.length === 0 ? (
            <div className="rounded-xl bg-gray-900 p-5 text-gray-400">
              No active incidents.
            </div>
          ) : (
            activeIncidents.map((incident) => (
              <IncidentCard key={incident.id} incident={incident} />
            ))
          )}
        </section>

        {currentUserRole !== "Member" && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-yellow-300">
                Pending Approval
              </h2>
              <span className="rounded bg-yellow-950/40 px-2 py-1 text-xs text-yellow-200">
                {pendingIncidents.length}
              </span>
            </div>

            {pendingIncidents.length === 0 ? (
              <div className="rounded-xl bg-gray-900 p-5 text-gray-400">
                No pending incidents.
              </div>
            ) : (
              pendingIncidents.map((incident) => (
                <IncidentCard key={incident.id} incident={incident} />
              ))
            )}
          </section>
        )}

        <section className="space-y-3">
          <button
            onClick={() => setClosedOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-xl bg-gray-900 px-4 py-3 text-left"
          >
            <div>
              <div className="text-lg font-semibold text-gray-300">
                Closed Incidents
              </div>
              <div className="text-sm text-gray-500">
                {closedIncidents.length} archived incident
                {closedIncidents.length === 1 ? "" : "s"}
              </div>
            </div>

            <div className="text-gray-400">
              {closedOpen ? "▲" : "▼"}
            </div>
          </button>

          {closedOpen && (
            <div className="space-y-3">
              {closedIncidents.length === 0 ? (
                <div className="rounded-xl bg-gray-950 p-5 text-gray-500">
                  No closed incidents.
                </div>
              ) : (
                closedIncidents.map((incident) => (
                  <IncidentCard key={incident.id} incident={incident} />
                ))
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}