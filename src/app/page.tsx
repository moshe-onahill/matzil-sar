"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getStoredRole, UserRole } from "@/lib/dev-user";
import MatzilLogo from "@/components/MatzilLogo";

type IncidentResponse = { user_id: string; response_type: string };
type IncidentUpdate = { created_at: string };

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

type UserRow = { id: string; full_name: string | null; call_sign: string | null };
type Announcement = { id: string; title: string; body: string | null; created_at: string };

export default function Dashboard() {
  const [role, setRole] = useState<UserRole>("Member");
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [creatorMap, setCreatorMap] = useState<Record<string, UserRow>>({});
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

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

    return () => { void supabase.removeChannel(channel); };
  }, []);

  async function loadData() {
    const [incRes, annRes] = await Promise.all([
      supabase
        .from("incidents")
        .select(`id, title, incident_number, type, status, staging_name, staging_address, created_at, created_by, incident_commander_call_sign, team_needs, incident_responses(user_id, response_type), incident_updates(created_at)`)
        .in("status", ["Active", "Pending"])
        .order("created_at", { ascending: false }),
      supabase
        .from("announcements")
        .select("id, title, body, created_at")
        .order("created_at", { ascending: false }),
    ]);

    const incidentRows = (incRes.data as unknown as Incident[]) ?? [];
    setIncidents(incidentRows);

    const creatorIds = Array.from(new Set(incidentRows.map((i) => i.created_by).filter((id): id is string => Boolean(id))));
    if (creatorIds.length > 0) {
      const { data: users } = await supabase.from("users").select("id, full_name, call_sign").in("id", creatorIds);
      const nextMap: Record<string, UserRow> = {};
      ((users as UserRow[]) ?? []).forEach((u) => { nextMap[u.id] = u; });
      setCreatorMap(nextMap);
    } else {
      setCreatorMap({});
    }

    setAnnouncements(
      ((annRes.data as Announcement[]) ?? []).filter(
        (a) => (Date.now() - new Date(a.created_at).getTime()) / (1000 * 60 * 60 * 24) <= 7
      )
    );
  }

  function responderCount(incident: Incident) {
    return incident.incident_responses?.filter(
      (r) => r.response_type !== "Cancelled" && r.response_type !== "Not Available"
    ).length ?? 0;
  }

  function latestUpdateAgeMinutes(incident: Incident) {
    if (!incident.incident_updates?.length) return null;
    const latest = incident.incident_updates.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    return Math.floor((Date.now() - new Date(latest.created_at).getTime()) / (1000 * 60));
  }

  function getWarnings(incident: Incident) {
    const count = responderCount(incident);
    const updateAge = latestUpdateAgeMinutes(incident);
    const warnings: string[] = [];
    if (count === 0) warnings.push("No responders yet");
    else if (count < 12) warnings.push(`${count} responders`);
    if (updateAge === null || updateAge >= 30) warnings.push("No update in 30 min");
    return warnings;
  }

  function formatDateTime(date: string) {
    return new Date(date).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function creatorLabel(incident: Incident) {
    if (!incident.created_by) return "Unknown";
    const creator = creatorMap[incident.created_by];
    return creator?.call_sign ? `${creator.call_sign}${creator.full_name ? ` — ${creator.full_name}` : ""}` : creator?.full_name || "Unknown";
  }

  const activeIncidents = useMemo(() => incidents.filter((i) => i.status === "Active" && i.type !== "Deployment"), [incidents]);
  const activeDeployments = useMemo(() => incidents.filter((i) => i.status === "Active" && i.type === "Deployment"), [incidents]);
  const pendingApprovals = useMemo(() => incidents.filter((i) => i.status === "Pending"), [incidents]);

  const canCreate = role === "Dispatcher" || role === "SAR Manager" || role === "Global Admin";

  return (
    <main className="min-h-screen bg-black px-4 py-5 pb-32 text-white sm:p-6 sm:pb-32">
      <div className="mx-auto max-w-5xl space-y-4">

        <div className="flex items-center justify-between">
          <MatzilLogo size={30} withText />
        </div>

        {/* Active Call hero */}
        {activeIncidents.length > 0 ? (
          <Link href={`/incidents/${activeIncidents[0].id}`} className="flex items-center justify-between rounded-2xl bg-red-600 p-5 shadow-lg">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-red-200">Active Call</div>
              <div className="mt-1 text-xl font-bold">{activeIncidents[0].title}</div>
              <div className="mt-1 text-sm text-red-200">{responderCount(activeIncidents[0])} responding</div>
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-10 w-10 text-red-200">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </Link>
        ) : (
          <div className="flex items-center justify-between rounded-2xl bg-gray-900 p-5">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-gray-500">Status</div>
              <div className="mt-1 text-xl font-semibold text-gray-300">No Active Calls</div>
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-10 w-10 text-gray-700">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
        )}

        {/* Send Alert — admins/dispatchers only */}
        {canCreate && (
          <div className="flex gap-2">
            <Link href="/create-incident" className="flex-1 rounded-xl bg-red-700 py-3 text-center font-semibold hover:bg-red-600">
              Create Incident
            </Link>
            {(role === "SAR Manager" || role === "Global Admin") && (
              <Link href="/create-deployment" className="flex-1 rounded-xl bg-gray-800 py-3 text-center font-semibold hover:bg-gray-700">
                New Deployment
              </Link>
            )}
          </div>
        )}

        {/* Announcements */}
        {announcements.length > 0 && (
          <div className="space-y-2 rounded-xl border border-blue-900 bg-blue-950/30 p-4">
            <div className="text-xs font-semibold uppercase tracking-widest text-blue-400">Announcements</div>
            {announcements.map((a) => (
              <div key={a.id}>
                <div className="font-medium">{a.title}</div>
                {a.body && <div className="mt-1 text-sm text-blue-200">{a.body}</div>}
              </div>
            ))}
          </div>
        )}

        {/* Active Calls list */}
        {activeIncidents.length > 1 && (
          <section className="space-y-3">
            <div className="text-sm font-semibold uppercase tracking-widest text-gray-500">All Active Calls</div>
            {activeIncidents.slice(1).map((incident) => (
              <Link key={incident.id} href={`/incidents/${incident.id}`} className="block rounded-xl bg-gray-900 p-4 hover:bg-gray-800">
                <div className="font-semibold">{incident.title}</div>
                <div className="mt-1 text-sm text-gray-400">{incident.staging_name || incident.staging_address || "No location"}</div>
                {getWarnings(incident).map((w) => (
                  <span key={w} className="mt-2 mr-2 inline-block rounded bg-black/40 px-2 py-0.5 text-xs text-orange-300">{w}</span>
                ))}
              </Link>
            ))}
          </section>
        )}

        {/* Active Deployments */}
        {activeDeployments.length > 0 && (
          <section className="space-y-3">
            <div className="text-sm font-semibold uppercase tracking-widest text-blue-400">Deployments</div>
            {activeDeployments.map((dep) => (
              <Link key={dep.id} href={`/incidents/${dep.id}`} className="block rounded-xl bg-blue-950/30 p-4 hover:bg-blue-950/50">
                <div className="font-semibold">{dep.title}</div>
                <div className="mt-1 text-sm text-gray-400">
                  {dep.incident_commander_call_sign ? `IC: ${dep.incident_commander_call_sign}` : "No IC assigned"} · {responderCount(dep)} responding
                </div>
              </Link>
            ))}
          </section>
        )}

        {/* Pending approvals — managers only */}
        {(role === "SAR Manager" || role === "Global Admin") && pendingApprovals.length > 0 && (
          <section className="space-y-3">
            <div className="text-sm font-semibold uppercase tracking-widest text-yellow-400">Pending Approval</div>
            {pendingApprovals.map((approval) => (
              <Link key={approval.id} href={`/incidents/${approval.id}`} className="block rounded-xl bg-yellow-950/30 p-4 hover:bg-yellow-950/50">
                <div className="font-medium">{approval.title}</div>
                <div className="mt-1 text-sm text-gray-400">Submitted by: {creatorLabel(approval)}</div>
              </Link>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
