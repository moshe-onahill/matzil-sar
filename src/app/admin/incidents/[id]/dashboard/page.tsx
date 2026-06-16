"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type User = { id: string; full_name: string | null; call_sign: string | null };
type Assignment = { user_id: string; user: User };
type Task = {
  id: string;
  task_number: string;
  description: string | null;
  status: string;
  task_lead_id: string | null;
  task_lead?: User | null;
  assignments: Assignment[];
};
type Update = {
  id: string;
  update_type: string;
  title: string;
  body: string | null;
  created_at: string;
};
type OnSceneUnit = User & { response_type: string };
type Incident = {
  id: string;
  title: string;
  incident_number: string;
  type: string;
  status: string;
  staging_name: string | null;
  staging_address: string | null;
  accepting_units: boolean;
  short_description: string | null;
};

const TASK_STATUS_STYLE: Record<string, string> = {
  Active: "border-green-700 bg-green-950/40",
  Suspended: "border-yellow-700 bg-yellow-950/40",
  Completed: "border-zinc-700 bg-zinc-900/40 opacity-60",
};

const TASK_STATUS_BADGE: Record<string, string> = {
  Active: "bg-green-700/60 text-green-200",
  Suspended: "bg-yellow-700/60 text-yellow-200",
  Completed: "bg-zinc-700/60 text-zinc-400",
};

function Clock() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="font-mono tabular-nums">
      {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
    </span>
  );
}

export default function CommandDashboardPage() {
  const { id } = useParams<{ id: string }>();

  const [incident, setIncident] = useState<Incident | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [onScene, setOnScene] = useState<OnSceneUnit[]>([]);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [loading, setLoading] = useState(true);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!id) return;
    void loadAll();
    pollRef.current = setInterval(() => void loadAll(), 30_000);

    const channel = supabase
      .channel(`dashboard-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "incident_tasks", filter: `incident_id=eq.${id}` }, () => void loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "task_assignments" }, () => void loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "incident_responses", filter: `incident_id=eq.${id}` }, () => void loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "incident_updates", filter: `incident_id=eq.${id}` }, () => void loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "incidents", filter: `id=eq.${id}` }, () => void loadAll())
      .subscribe();

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      void supabase.removeChannel(channel);
    };
  }, [id]);

  async function loadAll() {
    const [incRes, tasksRes, responsesRes, updatesRes] = await Promise.all([
      supabase.from("incidents").select(
        "id,title,incident_number,type,status,staging_name,staging_address,accepting_units,short_description"
      ).eq("id", id).single(),
      supabase.from("incident_tasks").select(`
        id, task_number, description, status, task_lead_id,
        task_lead:users!incident_tasks_task_lead_id_fkey ( id, full_name, call_sign ),
        assignments:task_assignments ( user_id, user:users ( id, full_name, call_sign ) )
      `).eq("incident_id", id).order("task_number"),
      supabase.from("incident_responses")
        .select("user_id, response_type, users ( id, full_name, call_sign )")
        .eq("incident_id", id)
        .in("response_type", ["On Location", "Responding"]),
      supabase.from("incident_updates")
        .select("id, update_type, title, body, created_at")
        .eq("incident_id", id)
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

    setIncident(incRes.data as Incident);

    const rawTasks = (tasksRes.data ?? []) as any[];
    setTasks(rawTasks.map((t) => ({
      ...t,
      task_lead: Array.isArray(t.task_lead) ? t.task_lead[0] ?? null : t.task_lead,
      assignments: (t.assignments ?? []).map((a: any) => ({
        user_id: a.user_id,
        user: Array.isArray(a.user) ? a.user[0] : a.user,
      })),
    })));

    setOnScene(((responsesRes.data ?? []) as any[]).map((r) => ({
      id: r.users?.id ?? r.user_id,
      full_name: r.users?.full_name ?? null,
      call_sign: r.users?.call_sign ?? null,
      response_type: r.response_type,
    })));

    setUpdates((updatesRes.data ?? []) as Update[]);
    setLastRefresh(new Date());
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950 text-white">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-red-500" />
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950 text-white">
        <p className="text-zinc-500">Incident not found.</p>
      </div>
    );
  }

  const onSceneCount = onScene.filter((u) => u.response_type === "On Location").length;
  const enRouteCount = onScene.filter((u) => u.response_type === "Responding").length;
  const activeTasks = tasks.filter((t) => t.status === "Active").length;
  const completedTasks = tasks.filter((t) => t.status === "Completed").length;

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950 text-white flex flex-col overflow-hidden" style={{ fontFamily: "system-ui, sans-serif" }}>

      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-zinc-800 px-8 py-4">
        <div className="flex items-center gap-6">
          <Link href={`/admin/incidents/${id}`} className="text-sm text-zinc-500 hover:text-zinc-300">← Admin</Link>
          <div className="flex items-center gap-3">
            <span className={`h-3 w-3 rounded-full ${incident.status === "Active" ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" : "bg-zinc-500"}`} />
            <span className="font-mono text-zinc-400">{incident.incident_number}</span>
            <span className={`rounded px-2.5 py-0.5 text-sm font-medium ${incident.status === "Active" ? "bg-red-950/60 text-red-300" : "bg-zinc-800 text-zinc-400"}`}>
              {incident.status}
            </span>
          </div>
        </div>
        <div className="text-xl font-medium text-zinc-400">
          <Clock />
        </div>
        <div className="text-right">
          <div className="text-xs text-zinc-600">
            Refreshed {lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
      </header>

      {/* Incident title + stats */}
      <div className="border-b border-zinc-800 px-8 py-5">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-50">{incident.title}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-zinc-400">
          <span>{incident.type}</span>
          {incident.staging_address && (
            <>
              <span className="text-zinc-700">·</span>
              <span>Staging: {incident.staging_name ? `${incident.staging_name} — ` : ""}{incident.staging_address}</span>
            </>
          )}
          {incident.short_description && (
            <>
              <span className="text-zinc-700">·</span>
              <span className="text-zinc-500">{incident.short_description}</span>
            </>
          )}
        </div>
        {/* Quick stats */}
        <div className="mt-4 flex flex-wrap gap-4">
          <Stat label="On Scene" value={onSceneCount} color="text-green-400" />
          <Stat label="En Route" value={enRouteCount} color="text-blue-400" />
          <Stat label="Active Tasks" value={activeTasks} color="text-yellow-400" />
          <Stat label="Completed" value={completedTasks} color="text-zinc-500" />
          <Stat label="Total Units" value={onScene.length} color="text-zinc-300" />
        </div>
      </div>

      {/* Main grid */}
      <div className="flex flex-1 gap-0 overflow-hidden">

        {/* Left — Task board */}
        <div className="flex-1 overflow-y-auto border-r border-zinc-800 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-zinc-200">Tasks</h2>
            <span className="text-sm text-zinc-600">{tasks.length} total</span>
          </div>

          {tasks.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 p-8 text-center text-zinc-600">No tasks assigned yet.</div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <div key={task.id} className={`rounded-xl border p-4 ${TASK_STATUS_STYLE[task.status] ?? "border-zinc-800 bg-zinc-900"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold font-mono text-zinc-100">{task.task_number}</span>
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${TASK_STATUS_BADGE[task.status] ?? "bg-zinc-700 text-zinc-400"}`}>
                          {task.status}
                        </span>
                      </div>
                      {task.description && (
                        <p className="mt-1 text-base text-zinc-300">{task.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                    {task.task_lead && (
                      <div className="flex items-center gap-1.5 text-yellow-400">
                        <span className="text-yellow-600">Lead:</span>
                        <span className="font-mono font-medium">{task.task_lead.call_sign ?? task.task_lead.full_name ?? "?"}</span>
                      </div>
                    )}
                    {task.assignments.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-zinc-600">Units:</span>
                        {task.assignments.map((a) => (
                          <span key={a.user_id} className="font-mono text-zinc-300">
                            {a.user?.call_sign ?? a.user?.full_name ?? "?"}
                            {task.task_lead_id === a.user_id ? " ★" : ""}
                          </span>
                        ))}
                      </div>
                    )}
                    {task.assignments.length === 0 && (
                      <span className="text-zinc-600 italic">No units assigned</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="flex w-80 flex-col overflow-hidden lg:w-96">

          {/* Units */}
          <div className="border-b border-zinc-800 p-5">
            <h2 className="mb-3 text-lg font-semibold text-zinc-200">
              Personnel
              <span className="ml-2 text-sm font-normal text-zinc-600">({onScene.length})</span>
            </h2>
            {onScene.length === 0 ? (
              <p className="text-sm text-zinc-600">No units responding.</p>
            ) : (
              <div className="space-y-1.5">
                {onScene.map((u) => (
                  <div key={u.id} className={`flex items-center justify-between rounded-lg px-3 py-2 ${u.response_type === "On Location" ? "bg-green-950/40 border border-green-800/60" : "bg-zinc-900 border border-zinc-800"}`}>
                    <span className="font-mono font-medium text-zinc-100">{u.call_sign ?? "—"}</span>
                    <span className={`text-xs ${u.response_type === "On Location" ? "text-green-400" : "text-blue-400"}`}>
                      {u.response_type === "On Location" ? "On Scene" : "En Route"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Updates feed */}
          <div className="flex-1 overflow-y-auto p-5">
            <h2 className="mb-3 text-lg font-semibold text-zinc-200">Recent Updates</h2>
            {updates.length === 0 ? (
              <p className="text-sm text-zinc-600">No updates posted yet.</p>
            ) : (
              <div className="space-y-3">
                {updates.map((u) => (
                  <div key={u.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-medium text-red-400">{u.update_type}</span>
                      <span className="text-xs text-zinc-600">
                        {new Date(u.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="font-medium text-zinc-100 text-sm">{u.title}</div>
                    {u.body && <div className="mt-1 text-xs text-zinc-400 leading-relaxed">{u.body}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className={`text-3xl font-bold tabular-nums ${color}`}>{value}</span>
      <span className="text-sm text-zinc-500">{label}</span>
    </div>
  );
}
