"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";

type User = { id: string; full_name: string | null; call_sign: string | null };
type OnSceneUnit = User & { response_type: string; eta_minutes: number | null; responded_at: string };
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
type Incident = { id: string; title: string; incident_number: string; type: string; status: string };

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

const STATUS_COLORS: Record<string, string> = {
  Active: "bg-green-900/60 text-green-300 border-green-800",
  Completed: "bg-gray-800 text-gray-400 border-gray-700",
  Suspended: "bg-yellow-900/60 text-yellow-300 border-yellow-800",
};

export default function IncidentCoordinationPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();

  const [incident, setIncident] = useState<Incident | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [onScene, setOnScene] = useState<OnSceneUnit[]>([]);
  const [loading, setLoading] = useState(true);

  // New task form
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  // Unit assignment panel
  const [assigningTask, setAssigningTask] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!id) return;
    void loadAll();
    pollRef.current = setInterval(() => void loadAll(), 20_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [id]);

  async function loadAll() {
    const [incRes, tasksRes, responsesRes, locRes] = await Promise.all([
      supabase.from("incidents").select("id,title,incident_number,type,status").eq("id", id).single(),
      supabase.from("incident_tasks").select(`
        id, task_number, description, status, task_lead_id,
        task_lead:users!incident_tasks_task_lead_id_fkey ( id, full_name, call_sign ),
        assignments:task_assignments ( user_id, user:users ( id, full_name, call_sign ) )
      `).eq("incident_id", id).order("task_number"),
      supabase.from("incident_responses")
        .select("user_id, response_type, eta_minutes, responded_at, users ( id, full_name, call_sign )")
        .eq("incident_id", id)
        .in("response_type", ["On Location", "Responding"]),
      fetch("/api/location").then((r) => r.json()).catch(() => []),
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

    const locMap = new Set<string>(((locRes as any[]) ?? []).map((l: any) => l.user_id));
    const units: OnSceneUnit[] = ((responsesRes.data ?? []) as any[]).map((r) => ({
      id: r.users?.id ?? r.user_id,
      full_name: r.users?.full_name ?? null,
      call_sign: r.users?.call_sign ?? null,
      response_type: r.response_type,
      eta_minutes: r.eta_minutes,
      responded_at: r.responded_at,
    }));
    setOnScene(units);
    setLoading(false);
  }

  function nextTaskNumber() {
    const nums = tasks.map((t) => parseInt(t.task_number.replace(/\D/g, ""), 10)).filter((n) => !isNaN(n));
    return `T-${nums.length ? Math.max(...nums) + 1 : 1}`;
  }

  async function createTask() {
    if (!id) return;
    setCreating(true);
    try {
      await taskApi({ action: "create_task", incident_id: id, task_number: nextTaskNumber(), description: newDesc.trim() || null });
      setNewDesc("");
      toast("Task created.", "success");
      await loadAll();
    } catch (e: any) { toast(e.message, "error"); }
    setCreating(false);
  }

  async function assignUnit(taskId: string, userId: string) {
    try {
      await taskApi({ action: "assign_unit", task_id: taskId, user_id: userId });
      await loadAll();
    } catch (e: any) { toast(e.message, "error"); }
  }

  async function removeUnit(taskId: string, userId: string) {
    try {
      await taskApi({ action: "remove_unit", task_id: taskId, user_id: userId });
      await loadAll();
    } catch (e: any) { toast(e.message, "error"); }
  }

  async function setLead(taskId: string, userId: string | null) {
    try {
      await taskApi({ action: "set_lead", task_id: taskId, user_id: userId });
      toast("Task lead updated.", "success");
      await loadAll();
    } catch (e: any) { toast(e.message, "error"); }
  }

  async function setStatus(taskId: string, status: string) {
    try {
      await taskApi({ action: "set_status", task_id: taskId, status });
      await loadAll();
    } catch (e: any) { toast(e.message, "error"); }
  }

  async function deleteTask(taskId: string, label: string) {
    if (!window.confirm(`Delete ${label}?`)) return;
    try {
      await taskApi({ action: "delete_task", task_id: taskId });
      toast("Task deleted.", "success");
      await loadAll();
    } catch (e: any) { toast(e.message, "error"); }
  }

  function userName(u: User | null | undefined) {
    if (!u) return "Unknown";
    return u.call_sign ? `${u.call_sign} — ${u.full_name ?? ""}` : (u.full_name ?? "Unknown");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-700 border-t-red-500" />
      </main>
    );
  }

  if (!incident) {
    return <main className="p-6"><p className="text-zinc-500">Incident not found.</p></main>;
  }

  // Units not yet assigned to this specific task
  function unassigned(task: Task) {
    const assigned = new Set(task.assignments.map((a) => a.user_id));
    return onScene.filter((u) => !assigned.has(u.id));
  }

  return (
    <main className="p-6 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-5">

        {/* Header */}
        <div>
          <Link href="/admin/incidents" className="text-sm text-gray-500 hover:text-gray-300">← Incident Coordination</Link>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-gray-500">{incident.incident_number}</span>
                <span className={`rounded px-2 py-0.5 text-xs ${incident.status === "Active" ? "bg-red-950/60 text-red-300" : "bg-gray-800 text-gray-400"}`}>
                  {incident.status}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-zinc-50">{incident.title}</h1>
              <p className="text-sm text-gray-500">{incident.type}</p>
            </div>
            <Link href={`/incidents/${incident.id}`}
              className="rounded-lg bg-gray-800 px-3 py-1.5 text-sm hover:bg-gray-700">
              Full Incident →
            </Link>
          </div>
        </div>

        {/* On-scene roster */}
        <section className="rounded-xl bg-gray-900 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Units on Scene / Responding</div>
            <span className="text-sm text-gray-500">{onScene.length} unit{onScene.length !== 1 ? "s" : ""}</span>
          </div>
          {onScene.length === 0 ? (
            <div className="text-sm text-gray-600">No units responding yet.</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {onScene.map((u) => (
                <div key={u.id} className={`rounded-lg border px-3 py-1.5 text-sm ${u.response_type === "On Location" ? "border-green-800 bg-green-950/40 text-green-300" : "border-gray-700 bg-gray-800 text-gray-300"}`}>
                  <span className="font-mono font-medium">{u.call_sign ?? "—"}</span>
                  {u.full_name ? <span className="ml-1.5 text-xs opacity-70">{u.full_name}</span> : null}
                  <span className="ml-2 text-xs opacity-50">{u.response_type === "On Location" ? "On Scene" : "En Route"}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Create task */}
        <section className="rounded-xl bg-gray-900 p-4 space-y-3">
          <div className="font-semibold">Create Task</div>
          <div className="flex gap-2">
            <div className="flex items-center rounded-lg bg-black px-3 py-2 text-sm font-mono text-gray-400 shrink-0">
              {nextTaskNumber()}
            </div>
            <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void createTask()}
              placeholder="Task description (optional)"
              className="flex-1 rounded-lg bg-black px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-red-600" />
            <button onClick={() => void createTask()} disabled={creating}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold disabled:opacity-60 hover:bg-red-500 shrink-0">
              {creating ? "…" : "Add Task"}
            </button>
          </div>
        </section>

        {/* Task board */}
        {tasks.length === 0 ? (
          <div className="rounded-xl bg-gray-900 p-8 text-center text-gray-600">No tasks yet. Create the first one above.</div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <div key={task.id} className={`rounded-xl border p-4 space-y-3 ${STATUS_COLORS[task.status] ?? "border-gray-800 bg-gray-900"}`}>
                {/* Task header */}
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold font-mono">{task.task_number}</span>
                      {task.description && <span className="text-sm text-gray-300">{task.description}</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 items-center">
                    {(["Active", "Suspended", "Completed"] as const).map((s) => (
                      <button key={s} onClick={() => void setStatus(task.id, s)}
                        className={`rounded px-2.5 py-1 text-xs font-medium transition ${task.status === s ? "bg-white/20 text-white" : "bg-black/20 text-gray-400 hover:bg-white/10"}`}>
                        {s}
                      </button>
                    ))}
                    <button onClick={() => void deleteTask(task.id, task.task_number)}
                      className="rounded px-2.5 py-1 text-xs text-red-400 hover:bg-red-950/60">
                      Delete
                    </button>
                  </div>
                </div>

                {/* Task lead */}
                <div className="space-y-1">
                  <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Task Lead</div>
                  <div className="flex flex-wrap gap-1.5">
                    {task.assignments.length === 0 ? (
                      <span className="text-sm text-gray-600">Assign units first</span>
                    ) : (
                      task.assignments.map((a) => (
                        <button key={a.user_id} onClick={() => void setLead(task.id, task.task_lead_id === a.user_id ? null : a.user_id)}
                          className={`rounded-lg px-3 py-1 text-sm transition ${task.task_lead_id === a.user_id ? "bg-yellow-600 text-white font-semibold" : "bg-black/30 text-gray-300 hover:bg-yellow-900/40"}`}>
                          {task.task_lead_id === a.user_id ? "★ " : ""}{a.user?.call_sign ?? a.user?.full_name ?? "?"}
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* Assigned units */}
                <div className="space-y-1">
                  <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Assigned Units ({task.assignments.length})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {task.assignments.map((a) => (
                      <div key={a.user_id} className="flex items-center gap-1 rounded-lg bg-black/30 pl-3 pr-1 py-1 text-sm">
                        <span className="font-mono">{a.user?.call_sign ?? a.user?.full_name ?? "?"}</span>
                        {task.task_lead_id === a.user_id && <span className="text-yellow-400 text-xs ml-1">Lead</span>}
                        <button onClick={() => void removeUnit(task.id, a.user_id)}
                          className="ml-1 rounded px-1.5 text-gray-500 hover:text-red-400">×</button>
                      </div>
                    ))}
                    {task.assignments.length === 0 && (
                      <span className="text-sm text-gray-600">No units assigned</span>
                    )}
                  </div>
                </div>

                {/* Assign units button */}
                <div>
                  {assigningTask === task.id ? (
                    <div className="space-y-2">
                      <div className="text-xs text-gray-500">Tap a unit to assign:</div>
                      <div className="flex flex-wrap gap-1.5">
                        {unassigned(task).map((u) => (
                          <button key={u.id} onClick={async () => { await assignUnit(task.id, u.id); }}
                            className={`rounded-lg border px-3 py-1.5 text-sm transition hover:bg-green-900/40 ${u.response_type === "On Location" ? "border-green-800 text-green-300" : "border-gray-700 text-gray-300"}`}>
                            {u.call_sign ?? u.full_name ?? "?"}{" "}
                            <span className="text-xs opacity-60">{u.response_type === "On Location" ? "On Scene" : "En Route"}</span>
                          </button>
                        ))}
                        {unassigned(task).length === 0 && (
                          <span className="text-sm text-gray-600">All available units are assigned.</span>
                        )}
                      </div>
                      <button onClick={() => setAssigningTask(null)} className="text-xs text-gray-500 hover:text-gray-300">
                        Done
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setAssigningTask(task.id)}
                      className="rounded-lg bg-black/30 px-3 py-1.5 text-sm text-gray-400 hover:bg-black/60 hover:text-white">
                      + Assign Unit
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
