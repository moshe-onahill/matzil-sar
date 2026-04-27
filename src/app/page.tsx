"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import RoleSwitcher from "@/components/RoleSwitcher";
import { getStoredRole, UserRole } from "@/lib/dev-user";

type IncidentResponse = {
  user_id: string;
  response_type: string;
};

type IncidentUpdate = {
  created_at: string;
};

type Incident = {
  id: string;
  title: string;
  incident_number: string;
  type: string;
  status: string;
  staging_name: string | null;
  staging_address: string | null;
  created_at: string;
  created_by: string | null;
  incident_commander_call_sign: string | null;
  team_needs: Record<string, number> | null;
  incident_responses: IncidentResponse[];
  incident_updates: IncidentUpdate[];
};

type UserRow = {
  id: string;
  full_name: string | null;
  call_sign: string | null;
};

type Announcement = {
  id: string;
  title: string;
  body: string | null;
  created_at: string;
};

export default function Dashboard() {
  const [role, setRole] = useState<UserRole>("Member");
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [creatorMap, setCreatorMap] = useState<Record<string, UserRow>>({});
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setRole(getStoredRole());
    void loadData();

    const channel = supabase
      .channel("dashboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "incidents" }, () => void loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "incident_responses" }, () => void loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "incident_updates" }, () => void loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, () => void loadData())
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  async function loadData() {
    const [incRes, annRes] = await Promise.all([
      supabase
        .from("incidents")
        .select(`
          id,
          title,
          incident_number,
          type,
          status,
          staging_name,
          staging_address,
          created_at,
          created_by,
          incident_commander_call_sign,
          team_needs,
          incident_responses (
            user_id,
            response_type
          ),
          incident_updates (
            created_at
          )
        `)
        .in("status", ["Active", "Pending"])
        .order("created_at", { ascending: false }),

      supabase
        .from("announcements")
        .select("id, title, body, created_at")
        .order("created_at", { ascending: false }),
    ]);

    const incidentRows = (incRes.data as unknown as Incident[]) ?? [];
    setIncidents(incidentRows);

    const creatorIds = Array.from(
      new Set(
        incidentRows
          .map((i) => i.created_by)
          .filter((id): id is string => Boolean(id))
      )
    );

    if (creatorIds.length > 0) {
      const { data: users } = await supabase
        .from("users")
        .select("id, full_name, call_sign")
        .in("id", creatorIds);

      const nextMap: Record<string, UserRow> = {};
      ((users as UserRow[]) ?? []).forEach((u) => {
        nextMap[u.id] = u;
      });

      setCreatorMap(nextMap);
    } else {
      setCreatorMap({});
    }

    const recentAnnouncements = ((annRes.data as Announcement[]) ?? []).filter(
      (a) => {
        const ageDays =
          (Date.now() - new Date(a.created_at).getTime()) /
          (1000 * 60 * 60 * 24);
        return ageDays <= 7;
      }
    );

    setAnnouncements(recentAnnouncements);
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

  function latestUpdateAgeMinutes(incident: Incident) {
    if (!incident.incident_updates || incident.incident_updates.length === 0) {
      return null;
    }

    const latest = incident.incident_updates
      .slice()
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];

    return Math.floor(
      (Date.now() - new Date(latest.created_at).getTime()) / (1000 * 60)
    );
  }

  function getWarnings(incident: Incident) {
    const count = responderCount(incident);
    const updateAge = latestUpdateAgeMinutes(incident);

    const warnings: string[] = [];

    if (count === 0) warnings.push("🔴 No responders");
    else if (count < 12) warnings.push("🟠 Less than 12 responders");

    if (updateAge === null || updateAge >= 30) {
      warnings.push("⚠️ No update in 30 min");
    }

    return warnings;
  }

  function formatDateTime(date: string) {
    return new Date(date).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function creatorLabel(incident: Incident) {
    if (!incident.created_by) return "Unknown";

    const creator = creatorMap[incident.created_by];

    if (creator?.call_sign) {
      return `${creator.call_sign}${
        creator.full_name ? ` - ${creator.full_name}` : ""
      }`;
    }

    return creator?.full_name || "Unknown";
  }

  function teamNeedsLabel(teamNeeds: Record<string, number> | null) {
    if (!teamNeeds) return "No team needs listed";

    const parts = Object.entries(teamNeeds)
      .filter(([, value]) => Number(value) > 0)
      .map(([key, value]) => `${key}: ${value}`);

    return parts.length ? parts.join(" • ") : "No team needs listed";
  }

  const activeIncidents = useMemo(
    () =>
      incidents.filter(
        (i) => i.status === "Active" && i.type !== "Deployment"
      ),
    [incidents]
  );

  const activeDeployments = useMemo(
    () =>
      incidents.filter(
        (i) => i.status === "Active" && i.type === "Deployment"
      ),
    [incidents]
  );

  const pendingApprovals = useMemo(
    () => incidents.filter((i) => i.status === "Pending"),
    [incidents]
  );

  const canCreate =
    role === "Dispatcher" ||
    role === "SAR Manager" ||
    role === "Global Admin";

  return (
    <main className="min-h-screen bg-black px-4 py-5 pb-32 text-white sm:p-6 sm:pb-32">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-gray-500">Matzil SAR</p>
            <h1 className="text-3xl font-bold">Dashboard</h1>
          </div>

          <RoleSwitcher />
        </div>

        {announcements.length > 0 && (
          <div className="space-y-2 rounded-xl bg-blue-900/40 p-4">
            {announcements.map((a) => (
              <div key={a.id}>
                <div className="font-medium">📢 {a.title}</div>
                {a.body && (
                  <div className="mt-1 text-sm text-blue-100">{a.body}</div>
                )}
              </div>
            ))}
          </div>
        )}

        <section className="space-y-3">
          <div className="text-lg font-semibold">Active Incidents</div>

          {activeIncidents.length === 0 && (
            <div className="rounded-xl bg-gray-900 p-5 text-gray-400">
              No active incidents.
            </div>
          )}

          {activeIncidents.map((incident) => (
            <Link
              key={incident.id}
              href={`/incidents/${incident.id}`}
              className="block rounded-xl bg-gray-900 p-5 hover:bg-gray-800"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="break-words text-xl font-semibold">
                    {incident.title}
                  </div>
                  <div className="mt-1 text-sm text-red-400">
                    {incident.status}
                  </div>
                  <div className="mt-2 break-words text-sm text-gray-400">
                    {incident.staging_name ||
                      incident.staging_address ||
                      "No location"}
                  </div>
                  <div className="mt-2 text-sm text-gray-500">
                    Created {formatDateTime(incident.created_at)}
                  </div>
                </div>

                <div className="shrink-0 text-sm text-gray-300 sm:text-right">
                  👤 {responderCount(incident)}
                </div>
              </div>

              {getWarnings(incident).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {getWarnings(incident).map((w) => (
                    <span
                      key={w}
                      className="rounded bg-black/40 px-2 py-1 text-orange-300"
                    >
                      {w}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </section>

        <section className="space-y-3">
          <div className="text-lg font-semibold text-blue-300">
            Active Deployments
          </div>

          {activeDeployments.length === 0 && (
            <div className="rounded-xl bg-gray-900 p-5 text-gray-400">
              No active deployments.
            </div>
          )}

          {activeDeployments.map((deployment) => (
            <Link
              key={deployment.id}
              href={`/incidents/${deployment.id}`}
              className="block rounded-xl bg-blue-950/30 p-5 hover:bg-blue-950/50"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="break-words text-lg font-semibold">
                    {deployment.title}
                  </div>
                  <div className="mt-1 text-sm text-gray-400">
                    Deployment date: {formatDateTime(deployment.created_at)}
                  </div>
                  <div className="mt-1 text-sm text-gray-400">
                    IC: {deployment.incident_commander_call_sign || "Not assigned"}
                  </div>
                  <div className="mt-2 text-sm text-blue-200">
                    {teamNeedsLabel(deployment.team_needs)}
                  </div>
                </div>

                <div className="text-sm text-gray-300">
                  👤 {responderCount(deployment)}
                </div>
              </div>
            </Link>
          ))}
        </section>

        {role === "SAR Manager" && (
          <section className="space-y-3">
            <div className="text-lg font-semibold text-yellow-300">
              Pending Approvals
            </div>

            {pendingApprovals.length === 0 && (
              <div className="rounded-xl bg-gray-900 p-5 text-gray-400">
                No pending approvals.
              </div>
            )}

            {pendingApprovals.map((approval) => (
              <Link
                key={approval.id}
                href={`/incidents/${approval.id}`}
                className="block rounded-xl bg-yellow-950/30 p-5 hover:bg-yellow-950/50"
              >
                <div className="break-words font-medium">{approval.title}</div>
                <div className="mt-1 text-sm text-gray-400">
                  Submitted by: {creatorLabel(approval)}
                </div>
              </Link>
            ))}
          </section>
        )}
      </div>

      {canCreate && (
        <div className="fixed bottom-24 right-4 z-[90] sm:bottom-28 sm:right-6">
          {menuOpen && (
            <div className="mb-3 w-56 space-y-2 rounded-xl border border-gray-800 bg-gray-900 p-3 shadow-xl">
              {(role === "Dispatcher" ||
                role === "SAR Manager" ||
                role === "Global Admin") && (
                <>
                  <Link
                    href="/create-incident"
                    className="block rounded bg-black/40 px-3 py-2 hover:bg-black"
                  >
                    Create Incident
                  </Link>

                  <Link
                    href="/create-deployment"
                    className="block rounded bg-black/40 px-3 py-2 hover:bg-black"
                  >
                    Create Deployment
                  </Link>
                </>
              )}

              {(role === "SAR Manager" || role === "Global Admin") && (
                <>
                  <Link
                    href="/incidents"
                    className="block rounded bg-black/40 px-3 py-2 hover:bg-black"
                  >
                    Approve Incidents
                  </Link>

                  <Link
                    href="/announcements"
                    className="block rounded bg-black/40 px-3 py-2 hover:bg-black"
                  >
                    Post Announcement
                  </Link>
                </>
              )}
            </div>
          )}

          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-3xl shadow-xl"
          >
            +
          </button>
        </div>
      )}
    </main>
  );
}