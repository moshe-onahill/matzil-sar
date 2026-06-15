"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import RoleSwitcher from "@/components/RoleSwitcher";
import { getStoredRole } from "@/lib/dev-user";

type ResponderRow = {
  id: string;
  full_name: string | null;
  call_sign: string | null;
  is_active: boolean | null;
  user_units: { units: { name: string }[] | { name: string } | null }[];
};

type ResponseRow = {
  user_id: string;
  incident_id: string;
  response_type: string;
  eta_minutes: number | null;
  available_at: string | null;
  responded_at: string | null;
  incidents: { id: string; incident_number: string; title: string; status: string } | { id: string; incident_number: string; title: string; status: string }[] | null;
};

type LiveLocationRow = { user_id: string; updated_at: string; is_moving: boolean | null; speed_mph: number | null };

type Task = { id: string; task_number: string; description: string | null; status: string };
type TaskAssignment = { task_id: string; user_id: string };

type ResponderView = {
  id: string;
  full_name: string;
  call_sign: string;
  units: string[];
  response_type: string | null;
  eta_minutes: number | null;
  available_at: string | null;
  responded_at: string | null;
  incident: { id: string; incident_number: string; title: string; status: string } | null;
  last_location_at: string | null;
  is_moving: boolean | null;
  speed_mph: number | null;
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

export default function RespondersPage() {
  const [responders, setResponders] = useState<ResponderView[]>([]);
  const [tasksByIncident, setTasksByIncident] = useState<Record<string, Task[]>>({});
  const [assignmentsByUser, setAssignmentsByUser] = useState<Record<string, string>>({});  // user_id → task_id
  const [search, setSearch] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [assigningUser, setAssigningUser] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    const role = getStoredRole();
    setIsAdmin(role === "SAR Manager" || role === "Global Admin" || role === "Dispatcher");

    void loadPage();

    const channel = supabase
      .channel("responders-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, () => void loadPage())
      .on("postgres_changes", { event: "*", schema: "public", table: "incident_responses" }, () => void loadPage())
      .on("postgres_changes", { event: "*", schema: "public", table: "live_locations" }, () => void loadPage())
      .on("postgres_changes", { event: "*", schema: "public", table: "incident_tasks" }, () => void loadPage())
      .on("postgres_changes", { event: "*", schema: "public", table: "task_assignments" }, () => void loadPage())
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, []);

  async function loadPage() {
    const [usersRes, responsesRes, liveLocData] = await Promise.all([
      supabase.from("users").select(`id, full_name, call_sign, is_active, user_units ( units ( name ) )`).eq("is_active", true).order("full_name"),
      supabase.from("incident_responses").select(`user_id, incident_id, response_type, eta_minutes, available_at, responded_at, incidents ( id, incident_number, title, status )`).in("response_type", ["Responding", "On Location"]).order("responded_at", { ascending: false }),
      fetch("/api/location").then((r) => r.json()).catch(() => []),
    ]);

    const users = (usersRes.data as ResponderRow[]) ?? [];
    const responses = (responsesRes.data as ResponseRow[]) ?? [];
    const locations = (Array.isArray(liveLocData) ? liveLocData : []) as LiveLocationRow[];

    const latestResponseByUser = new Map<string, ResponseRow>();
    for (const r of responses) {
      if (!latestResponseByUser.has(r.user_id)) latestResponseByUser.set(r.user_id, r);
    }

    const latestLocationByUser = new Map<string, LiveLocationRow>();
    for (const l of locations) {
      if (!latestLocationByUser.has(l.user_id)) latestLocationByUser.set(l.user_id, l);
    }

    const respondingUsers = users
      .filter((u) => latestResponseByUser.has(u.id))
      .map((u) => {
        const response = latestResponseByUser.get(u.id)!;
        const location = latestLocationByUser.get(u.id) ?? null;
        const units = extractNames(u.user_units ?? []);
        let incident: ResponderView["incident"] = null;
        if (response.incidents) {
          incident = Array.isArray(response.incidents) ? response.incidents[0] ?? null : response.incidents;
        }
        return {
          id: u.id,
          full_name: u.full_name || "Unknown",
          call_sign: u.call_sign || "No Call Sign",
          units,
          response_type: response.response_type,
          eta_minutes: response.eta_minutes ?? null,
          available_at: response.available_at ?? null,
          responded_at: response.responded_at ?? null,
          incident,
          last_location_at: location?.updated_at ?? null,
          is_moving: location?.is_moving ?? null,
          speed_mph: location?.speed_mph ?? null,
        };
      });

    setResponders(respondingUsers);

    // Load tasks for all active incidents
    const incidentIds = [...new Set(respondingUsers.map((r) => r.incident?.id).filter(Boolean) as string[])];
    if (incidentIds.length) {
      const [tasksRes, assignRes] = await Promise.all([
        supabase.from("incident_tasks").select("id,task_number,description,status").in("incident_id", incidentIds).eq("status", "Active"),
        supabase.from("task_assignments").select("task_id,user_id"),
      ]);

      const tasks = (tasksRes.data as Task[]) ?? [];
      const assignments = (assignRes.data as TaskAssignment[]) ?? [];

      // Group tasks by incident — we need to know which incident each task belongs to
      const tasksWithIncident = await supabase
        .from("incident_tasks")
        .select("id,incident_id")
        .in("id", tasks.map((t) => t.id));

      const taskIncidentMap = new Map<string, string>(); // task_id → incident_id
      for (const t of (tasksWithIncident.data ?? [])) {
        taskIncidentMap.set((t as any).id, (t as any).incident_id);
      }

      const byIncident: Record<string, Task[]> = {};
      for (const task of tasks) {
        const iid = taskIncidentMap.get(task.id);
        if (!iid) continue;
        byIncident[iid] = [...(byIncident[iid] ?? []), task];
      }
      setTasksByIncident(byIncident);

      // Build user → task map (one task per user per incident for display)
      const userTaskMap: Record<string, string> = {};
      for (const a of assignments) {
        userTaskMap[a.user_id] = a.task_id;
      }
      setAssignmentsByUser(userTaskMap);
    }
  }

  function extractNames(items: any[]) {
    return items.flatMap((item) => {
      const v = item?.units;
      if (Array.isArray(v)) return v.map((x: any) => x?.name).filter(Boolean);
      if (v?.name) return [v.name];
      return [];
    });
  }

  function formatEta(row: ResponderView) {
    if (row.response_type === "On Location") return "On Scene";
    if (row.eta_minutes !== null && row.responded_at) {
      const eta = new Date(new Date(row.responded_at).getTime() + row.eta_minutes * 60_000);
      return `ETA ${eta.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}`;
    }
    return "Responding";
  }

  function formatLocationLabel(row: ResponderView) {
    if (!row.last_location_at) return "No location";
    return row.is_moving ? `Moving${row.speed_mph ? ` • ${row.speed_mph} mph` : ""}` : "Stationary";
  }

  async function assignToTask(userId: string, incidentId: string, taskId: string | null) {
    setAssigning(true);
    try {
      // Remove from any existing task for this incident
      const currentTaskId = assignmentsByUser[userId];
      if (currentTaskId) {
        await taskApi({ action: "remove_unit", task_id: currentTaskId, user_id: userId });
      }
      if (taskId) {
        await taskApi({ action: "assign_unit", task_id: taskId, user_id: userId });
      }
      setAssigningUser(null);
      await loadPage();
    } catch (e: any) {
      console.error(e);
    }
    setAssigning(false);
  }

  const filtered = useMemo(() => responders.filter((row) => {
    const q = search.toLowerCase();
    return (
      row.full_name.toLowerCase().includes(q) ||
      row.call_sign.toLowerCase().includes(q) ||
      row.units.join(", ").toLowerCase().includes(q) ||
      row.incident?.title.toLowerCase().includes(q) ||
      row.incident?.incident_number.toLowerCase().includes(q)
    );
  }), [responders, search]);

  return (
    <main className="min-h-screen bg-black px-4 py-5 pb-28 text-white sm:p-6 sm:pb-28">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="space-y-3">
          <div>
            <p className="text-sm text-gray-500">Matzil SAR</p>
            <h1 className="text-4xl font-bold leading-tight sm:text-3xl">Responding Units</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <RoleSwitcher />
            <Link href="/" className="rounded border border-gray-800 bg-gray-900 px-4 py-2 text-sm">Dashboard</Link>
          </div>
        </div>

        <div className="rounded-xl bg-gray-900 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm text-gray-400">Currently Responding</div>
              <div className="text-2xl font-bold">{filtered.length}</div>
            </div>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search"
              className="w-40 rounded bg-black px-3 py-2 text-sm sm:w-64" />
          </div>
        </div>

        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className="rounded-xl bg-gray-900 p-5 text-gray-400">No units are currently responding.</div>
          )}

          {filtered.map((row) => {
            const incidentTasks = row.incident ? (tasksByIncident[row.incident.id] ?? []) : [];
            const currentTaskId = assignmentsByUser[row.id] ?? null;
            const currentTask = incidentTasks.find((t) => t.id === currentTaskId) ?? null;
            const isAssigning = assigningUser === row.id;

            return (
              <div key={row.id} className="rounded-lg bg-gray-900 p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-lg font-semibold leading-tight">{row.call_sign}</div>
                      <span className={`rounded px-2 py-0.5 text-xs ${row.response_type === "On Location" ? "bg-green-950/60 text-green-300" : "bg-red-950/50 text-red-200"}`}>
                        {formatEta(row)}
                      </span>
                      {currentTask && (
                        <span className="rounded bg-blue-950/60 px-2 py-0.5 text-xs text-blue-300 font-mono">
                          {currentTask.task_number}{currentTask.description ? ` — ${currentTask.description}` : ""}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-sm text-gray-400">{row.full_name}</div>
                    <div className="mt-1 text-xs text-gray-500">{row.units.length ? row.units.join(", ") : "No unit listed"}</div>
                  </div>

                  <div className="shrink-0 text-right text-xs text-gray-400">
                    <div>{formatLocationLabel(row)}</div>
                    {row.last_location_at && (
                      <div className="mt-0.5 text-gray-500">
                        {new Date(row.last_location_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    )}
                  </div>
                </div>

                {row.incident && (
                  <Link href={`/incidents/${row.incident.id}`} className="block rounded bg-black/30 px-3 py-2 text-sm">
                    <div className="truncate font-medium">{row.incident.title}</div>
                    <div className="text-xs text-gray-500">{row.incident.incident_number} • {row.incident.status}</div>
                  </Link>
                )}

                {/* Task assignment — admins only, only when there are tasks for this incident */}
                {isAdmin && incidentTasks.length > 0 && (
                  <div>
                    {isAssigning ? (
                      <div className="rounded-lg bg-black/30 p-3 space-y-2">
                        <div className="text-xs text-gray-500">Assign to task:</div>
                        <div className="flex flex-wrap gap-1.5">
                          {incidentTasks.map((t) => (
                            <button key={t.id} disabled={assigning}
                              onClick={() => void assignToTask(row.id, row.incident!.id, t.id)}
                              className={`rounded-lg px-3 py-1.5 text-sm font-mono transition disabled:opacity-50 ${currentTaskId === t.id ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-blue-900/60"}`}>
                              {t.task_number}{t.description ? ` — ${t.description}` : ""}
                            </button>
                          ))}
                          {currentTaskId && (
                            <button disabled={assigning}
                              onClick={() => void assignToTask(row.id, row.incident!.id, null)}
                              className="rounded-lg bg-gray-800 px-3 py-1.5 text-sm text-gray-400 hover:bg-gray-700 disabled:opacity-50">
                              Unassign
                            </button>
                          )}
                        </div>
                        <button onClick={() => setAssigningUser(null)} className="text-xs text-gray-600 hover:text-gray-400">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setAssigningUser(row.id)}
                        className="rounded-lg bg-black/30 px-3 py-1.5 text-xs text-gray-500 hover:text-white hover:bg-black/60 transition">
                        {currentTask ? `Task: ${currentTask.task_number} — change` : "Assign to task"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
