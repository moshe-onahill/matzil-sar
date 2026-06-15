"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";

type LiveLocation = {
  user_id: string;
  lat: number;
  lng: number;
  updated_at: string;
};

type Response = {
  id: string;
  user_id: string;
  incident_id: string;
  response_type: string;
  eta_minutes: number | null;
  responded_at: string;
  users?: { full_name: string | null; call_sign: string | null; phone: string | null };
  incidents?: { title: string; incident_number: string; status: string };
};

type Task = { id: string; incident_id: string; task_number: string; description: string | null; status: string };
type TaskAssignment = { task_id: string; user_id: string };

type UnitRow = {
  user_id: string;
  incident_id: string;
  full_name: string;
  call_sign: string;
  phone: string;
  incident_number: string;
  incident_title: string;
  response_type: string;
  eta_minutes: number | null;
  responded_at: string;
  has_location: boolean;
  lat: number | null;
  lng: number | null;
  location_age_min: number | null;
};

async function taskApi(body: object) {
  const res = await fetch("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed");
  return data;
}

export default function AdminUnitsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<UnitRow[]>([]);
  const [tasksByIncident, setTasksByIncident] = useState<Record<string, Task[]>>({});
  const [assignmentsByUser, setAssignmentsByUser] = useState<Record<string, string>>({}); // user_id → task_id
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "responding" | "on_location">("all");
  const [assigningUser, setAssigningUser] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    void loadData();
    intervalRef.current = setInterval(() => void loadData(), 15_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  async function loadData() {
    const [responsesRes, locRes] = await Promise.all([
      supabase
        .from("incident_responses")
        .select(`id, user_id, incident_id, response_type, eta_minutes, responded_at,
          users ( full_name, call_sign, phone ),
          incidents ( title, incident_number, status )`)
        .in("response_type", ["Responding", "On Location"])
        .order("responded_at", { ascending: false }),
      fetch("/api/location").then((r) => r.json()),
    ]);

    const locationMap = new Map<string, LiveLocation>();
    ((locRes as LiveLocation[]) ?? []).forEach((l) => locationMap.set(l.user_id, l));

    const now = Date.now();
    const combined: UnitRow[] = ((responsesRes.data ?? []) as unknown as Response[])
      .filter((r) => r.incidents?.status === "Active")
      .map((r) => {
        const loc = locationMap.get(r.user_id);
        const ageMin = loc ? Math.round((now - new Date(loc.updated_at).getTime()) / 60_000) : null;
        return {
          user_id: r.user_id,
          incident_id: r.incident_id,
          full_name: r.users?.full_name ?? "—",
          call_sign: r.users?.call_sign ?? "—",
          phone: r.users?.phone ?? "—",
          incident_number: r.incidents?.incident_number ?? "—",
          incident_title: r.incidents?.title ?? "—",
          response_type: r.response_type,
          eta_minutes: r.eta_minutes,
          responded_at: r.responded_at,
          has_location: !!loc,
          lat: loc?.lat ?? null,
          lng: loc?.lng ?? null,
          location_age_min: ageMin,
        };
      });

    setRows(combined);

    // Load tasks for all active incidents
    const incidentIds = [...new Set(combined.map((r) => r.incident_id))];
    if (incidentIds.length) {
      const [tasksRes, assignRes] = await Promise.all([
        supabase.from("incident_tasks").select("id,incident_id,task_number,description,status").in("incident_id", incidentIds).eq("status", "Active"),
        supabase.from("task_assignments").select("task_id,user_id"),
      ]);

      const tasks = (tasksRes.data as Task[]) ?? [];
      const assignments = (assignRes.data as TaskAssignment[]) ?? [];

      const byIncident: Record<string, Task[]> = {};
      for (const t of tasks) {
        byIncident[t.incident_id] = [...(byIncident[t.incident_id] ?? []), t];
      }
      setTasksByIncident(byIncident);

      const userTaskMap: Record<string, string> = {};
      for (const a of assignments) userTaskMap[a.user_id] = a.task_id;
      setAssignmentsByUser(userTaskMap);
    } else {
      setTasksByIncident({});
      setAssignmentsByUser({});
    }

    setLoading(false);
  }

  async function assignToTask(userId: string, taskId: string | null) {
    setAssigning(true);
    try {
      const currentTaskId = assignmentsByUser[userId];
      if (currentTaskId) await taskApi({ action: "remove_unit", task_id: currentTaskId, user_id: userId });
      if (taskId) await taskApi({ action: "assign_unit", task_id: taskId, user_id: userId });
      setAssigningUser(null);
      toast(taskId ? "Task assigned." : "Unassigned.", "success");
      await loadData();
    } catch (e: any) { toast(e.message, "error"); }
    setAssigning(false);
  }

  function exportCsv() {
    const cols = ["Name", "Call Sign", "Phone", "Incident #", "Incident", "Status", "Task", "ETA", "Has GPS", "Lat", "Lng", "GPS Age (min)", "Responded At"];
    const data = filtered.map((r) => {
      const task = getTask(r.user_id, r.incident_id);
      return [
        r.full_name, r.call_sign, r.phone,
        r.incident_number, r.incident_title, r.response_type,
        task ? `${task.task_number}${task.description ? ` — ${task.description}` : ""}` : "",
        r.eta_minutes != null ? new Date(new Date(r.responded_at).getTime() + r.eta_minutes * 60_000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
        r.has_location ? "Yes" : "No",
        r.lat ?? "", r.lng ?? "",
        r.location_age_min ?? "",
        new Date(r.responded_at).toLocaleString(),
      ];
    });
    const csv = [cols, ...data].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `responding-units-${new Date().toISOString().slice(0, 16).replace("T", "-")}.csv`;
    a.click();
  }

  function getTask(userId: string, incidentId: string): Task | null {
    const taskId = assignmentsByUser[userId];
    if (!taskId) return null;
    return (tasksByIncident[incidentId] ?? []).find((t) => t.id === taskId) ?? null;
  }

  const filtered = useMemo(() => {
    let list = rows;
    if (filterStatus === "responding") list = list.filter((r) => r.response_type === "Responding");
    if (filterStatus === "on_location") list = list.filter((r) => r.response_type === "On Location");
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((r) =>
        r.full_name.toLowerCase().includes(q) ||
        r.call_sign.toLowerCase().includes(q) ||
        r.incident_number.toLowerCase().includes(q) ||
        r.incident_title.toLowerCase().includes(q)
      );
    }
    return list;
  }, [rows, search, filterStatus]);

  return (
    <main className="min-h-screen bg-black px-4 py-5 pb-28 text-white sm:px-6">
      <div className="mx-auto max-w-[1400px] space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-300">← Admin Console</Link>
            <h1 className="mt-1 text-2xl font-bold">Responding Units</h1>
            <p className="text-sm text-gray-500">Live — refreshes every 15s</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => void loadData()} className="rounded-lg bg-gray-800 px-4 py-2 text-sm hover:bg-gray-700">Refresh</button>
            <button onClick={exportCsv} className="rounded-lg bg-gray-800 px-4 py-2 text-sm hover:bg-gray-700">Export CSV</button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {([["all", "All"], ["responding", "Responding"], ["on_location", "On Location"]] as const).map(([f, label]) => (
            <button key={f} onClick={() => setFilterStatus(f)}
              className={`rounded-lg px-3 py-1.5 text-sm ${filterStatus === f ? "bg-red-600 text-white" : "bg-gray-800 text-gray-400"}`}>
              {label}
            </button>
          ))}
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, call sign, incident…"
            className="ml-auto rounded-lg bg-gray-900 px-3 py-1.5 text-sm w-56 outline-none focus:ring-1 focus:ring-red-600" />
        </div>

        <div className="text-sm text-gray-500">{filtered.length} unit{filtered.length !== 1 ? "s" : ""}</div>

        {loading ? (
          <div className="animate-pulse space-y-2">
            {[...Array(4)].map((_, i) => <div key={i} className="h-12 rounded bg-gray-900" />)}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full min-w-[1000px] text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Call Sign</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Incident</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Task</th>
                  <th className="px-4 py-3">ETA</th>
                  <th className="px-4 py-3">GPS</th>
                  <th className="px-4 py-3">Responded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {filtered.map((r, i) => {
                  const task = getTask(r.user_id, r.incident_id);
                  const incidentTasks = tasksByIncident[r.incident_id] ?? [];
                  const isAssigning = assigningUser === r.user_id;

                  return (
                    <tr key={`${r.user_id}-${i}`} className="hover:bg-gray-900/60 transition align-top">
                      <td className="px-4 py-3 font-medium">{r.full_name}</td>
                      <td className="px-4 py-3 font-mono text-gray-300">{r.call_sign}</td>
                      <td className="px-4 py-3 text-gray-400">{r.phone}</td>
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs text-gray-500">{r.incident_number}</div>
                        <div className="text-gray-200">{r.incident_title}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${r.response_type === "On Location" ? "bg-green-900/60 text-green-300" : "bg-blue-900/60 text-blue-300"}`}>
                          {r.response_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {isAssigning ? (
                          <div className="space-y-1.5 min-w-[200px]">
                            {incidentTasks.length === 0 ? (
                              <span className="text-xs text-gray-600">No tasks for this incident yet.</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {incidentTasks.map((t) => (
                                  <button key={t.id} disabled={assigning}
                                    onClick={() => void assignToTask(r.user_id, t.id)}
                                    className={`rounded px-2.5 py-1 text-xs font-mono disabled:opacity-50 transition ${assignmentsByUser[r.user_id] === t.id ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-blue-900/60"}`}>
                                    {t.task_number}{t.description ? ` — ${t.description}` : ""}
                                  </button>
                                ))}
                                {assignmentsByUser[r.user_id] && (
                                  <button disabled={assigning}
                                    onClick={() => void assignToTask(r.user_id, null)}
                                    className="rounded px-2.5 py-1 text-xs bg-gray-800 text-gray-500 hover:text-red-400 disabled:opacity-50">
                                    Unassign
                                  </button>
                                )}
                              </div>
                            )}
                            <button onClick={() => setAssigningUser(null)} className="text-xs text-gray-600 hover:text-gray-400">
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setAssigningUser(r.user_id)}
                            className={`rounded px-2.5 py-1 text-xs transition hover:ring-1 hover:ring-blue-600 ${task ? "bg-blue-950/60 text-blue-300 font-mono" : "text-gray-600 hover:text-gray-300"}`}>
                            {task ? `${task.task_number}${task.description ? ` — ${task.description}` : ""}` : "Assign task"}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {r.eta_minutes != null ? (() => {
                          const arrival = new Date(new Date(r.responded_at).getTime() + r.eta_minutes * 60_000);
                          return arrival.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                        })() : <span className="text-gray-600">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {r.has_location ? (
                          <div>
                            <div className="flex items-center gap-1 text-green-400">
                              <span className="h-2 w-2 rounded-full bg-green-400 inline-block" />
                              Live
                            </div>
                            <div className="text-xs text-gray-500">{r.location_age_min != null ? `${r.location_age_min}m ago` : ""}</div>
                            {r.lat && r.lng && (
                              <a href={`https://maps.google.com/?q=${r.lat},${r.lng}`} target="_blank" rel="noopener noreferrer"
                                className="text-xs text-blue-400 hover:underline">
                                {r.lat.toFixed(4)}, {r.lng.toFixed(4)}
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-600">No GPS</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{new Date(r.responded_at).toLocaleString()}</td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-gray-600">No active responding units.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
