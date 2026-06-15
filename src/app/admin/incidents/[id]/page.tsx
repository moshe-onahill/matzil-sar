"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import { getCurrentTestEmail } from "@/lib/dev-user";

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
type Incident = {
  id: string;
  title: string;
  incident_number: string;
  type: string;
  status: string;
  short_description: string | null;
  accepting_units: boolean;
  staging_name: string | null;
  staging_address: string | null;
  staging_lat: number | null;
  staging_lng: number | null;
};

const INCIDENT_TYPES = [
  "Search and Rescue", "Medical", "Evacuation", "Technical Rescue",
  "Water Rescue", "Swift Water Rescue", "Lost Person", "Training Exercise", "Other",
];
const UPDATE_TYPES = ["General Update", "Operational Update", "Safety Alert", "Resource Request", "Situation Report", "Stand Down"];

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

type ActiveTab = "coordination" | "edit" | "updates";

export default function IncidentCoordinationPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();

  const [incident, setIncident] = useState<Incident | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [onScene, setOnScene] = useState<OnSceneUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>("coordination");

  // Current user id for posting updates
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // New task form
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  // Unit assignment panel
  const [assigningTask, setAssigningTask] = useState<string | null>(null);

  // Edit form state
  const [editTitle, setEditTitle] = useState("");
  const [editType, setEditType] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editStagingName, setEditStagingName] = useState("");
  const [editStagingAddress, setEditStagingAddress] = useState("");
  const [editStagingLat, setEditStagingLat] = useState("");
  const [editStagingLng, setEditStagingLng] = useState("");
  const [editAcceptingUnits, setEditAcceptingUnits] = useState(true);
  const [saving, setSaving] = useState(false);

  // Post update form state
  const [updateType, setUpdateType] = useState("General Update");
  const [updateTitle, setUpdateTitle] = useState("");
  const [updateBody, setUpdateBody] = useState("");
  const [updateAudience, setUpdateAudience] = useState<"all" | "on_scene" | "tasks">("all");
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [postingUpdate, setPostingUpdate] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!id) return;
    sessionStorage.setItem("admin-last-incident", id);
    void loadAll();
    void loadCurrentUser();
    pollRef.current = setInterval(() => void loadAll(), 20_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [id]);

  async function loadCurrentUser() {
    const email = getCurrentTestEmail();
    if (!email) return;
    const { data } = await supabase.from("users").select("id").eq("email", email).single();
    if (data) setCurrentUserId(data.id);
  }

  async function loadAll() {
    const [incRes, tasksRes, responsesRes] = await Promise.all([
      supabase.from("incidents").select(
        "id,title,incident_number,type,status,short_description,accepting_units,staging_name,staging_address,staging_lat,staging_lng"
      ).eq("id", id).single(),
      supabase.from("incident_tasks").select(`
        id, task_number, description, status, task_lead_id,
        task_lead:users!incident_tasks_task_lead_id_fkey ( id, full_name, call_sign ),
        assignments:task_assignments ( user_id, user:users ( id, full_name, call_sign ) )
      `).eq("incident_id", id).order("task_number"),
      supabase.from("incident_responses")
        .select("user_id, response_type, eta_minutes, responded_at, users ( id, full_name, call_sign )")
        .eq("incident_id", id)
        .in("response_type", ["On Location", "Responding"]),
    ]);

    const inc = incRes.data as Incident;
    setIncident(inc);
    if (inc) {
      setEditTitle(inc.title);
      setEditType(inc.type);
      setEditStatus(inc.status);
      setEditDesc(inc.short_description ?? "");
      setEditStagingName(inc.staging_name ?? "");
      setEditStagingAddress(inc.staging_address ?? "");
      setEditStagingLat(inc.staging_lat != null ? String(inc.staging_lat) : "");
      setEditStagingLng(inc.staging_lng != null ? String(inc.staging_lng) : "");
      setEditAcceptingUnits(inc.accepting_units);
    }

    const rawTasks = (tasksRes.data ?? []) as any[];
    setTasks(rawTasks.map((t) => ({
      ...t,
      task_lead: Array.isArray(t.task_lead) ? t.task_lead[0] ?? null : t.task_lead,
      assignments: (t.assignments ?? []).map((a: any) => ({
        user_id: a.user_id,
        user: Array.isArray(a.user) ? a.user[0] : a.user,
      })),
    })));

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

  async function saveIncident() {
    if (!id) return;
    setSaving(true);
    const lat = editStagingLat ? parseFloat(editStagingLat) : null;
    const lng = editStagingLng ? parseFloat(editStagingLng) : null;
    const { error } = await supabase.from("incidents").update({
      title: editTitle.trim(),
      type: editType,
      status: editStatus,
      short_description: editDesc.trim() || null,
      staging_name: editStagingName.trim() || null,
      staging_address: editStagingAddress.trim() || null,
      staging_lat: isNaN(lat as number) ? null : lat,
      staging_lng: isNaN(lng as number) ? null : lng,
      accepting_units: editAcceptingUnits,
    }).eq("id", id);
    setSaving(false);
    if (error) { toast(error.message, "error"); return; }
    toast("Incident updated.", "success");
    await loadAll();
  }

  async function postUpdate() {
    if (!id || !currentUserId) return;
    if (!updateTitle.trim()) { toast("Update title is required.", "error"); return; }
    setPostingUpdate(true);

    const { error } = await supabase.from("incident_updates").insert({
      incident_id: id,
      update_type: updateType,
      title: updateTitle.trim(),
      body: updateBody.trim() || null,
      created_by: currentUserId,
    });

    if (error) {
      setPostingUpdate(false);
      toast(error.message, "error");
      return;
    }

    let recipientIds: string[] = [];
    if (updateAudience === "all") {
      const { data } = await supabase.from("incident_responses").select("user_id")
        .eq("incident_id", id).in("response_type", ["Responding", "On Location"]);
      recipientIds = (data ?? []).map((r: any) => r.user_id);
    } else if (updateAudience === "on_scene") {
      const { data } = await supabase.from("incident_responses").select("user_id")
        .eq("incident_id", id).eq("response_type", "On Location");
      recipientIds = (data ?? []).map((r: any) => r.user_id);
    } else if (updateAudience === "tasks" && selectedTaskIds.length > 0) {
      const { data } = await supabase.from("task_assignments").select("user_id").in("task_id", selectedTaskIds);
      recipientIds = [...new Set((data ?? []).map((r: any) => r.user_id))];
    }

    if (recipientIds.length > 0) {
      await supabase.from("notification_logs").insert(
        recipientIds.map((uid) => ({
          user_id: uid,
          channel: "app",
          notification_type: "incident_update",
          title: `Update: ${updateTitle.trim()}`,
          body: updateBody.trim() || "New incident update",
          related_incident_id: id,
          status: "pending",
        }))
      );
    }

    setPostingUpdate(false);
    setUpdateTitle("");
    setUpdateBody("");
    setSelectedTaskIds([]);
    toast("Update posted.", "success");
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
    try { await taskApi({ action: "assign_unit", task_id: taskId, user_id: userId }); await loadAll(); }
    catch (e: any) { toast(e.message, "error"); }
  }

  async function removeUnit(taskId: string, userId: string) {
    try { await taskApi({ action: "remove_unit", task_id: taskId, user_id: userId }); await loadAll(); }
    catch (e: any) { toast(e.message, "error"); }
  }

  async function setLead(taskId: string, userId: string | null) {
    try { await taskApi({ action: "set_lead", task_id: taskId, user_id: userId }); toast("Lead updated.", "success"); await loadAll(); }
    catch (e: any) { toast(e.message, "error"); }
  }

  async function setStatus(taskId: string, status: string) {
    try { await taskApi({ action: "set_status", task_id: taskId, status }); await loadAll(); }
    catch (e: any) { toast(e.message, "error"); }
  }

  async function deleteTask(taskId: string, label: string) {
    if (!window.confirm(`Delete ${label}?`)) return;
    try { await taskApi({ action: "delete_task", task_id: taskId }); toast("Task deleted.", "success"); await loadAll(); }
    catch (e: any) { toast(e.message, "error"); }
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

  function unassigned(task: Task) {
    const assigned = new Set(task.assignments.map((a) => a.user_id));
    return onScene.filter((u) => !assigned.has(u.id));
  }

  const TABS: { id: ActiveTab; label: string }[] = [
    { id: "coordination", label: "Coordination" },
    { id: "edit", label: "Edit Incident" },
    { id: "updates", label: "Post Update" },
  ];

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
                {incident.accepting_units && (
                  <span className="rounded px-2 py-0.5 text-xs bg-green-950/60 text-green-300">Accepting Units</span>
                )}
              </div>
              <h1 className="text-2xl font-bold text-zinc-50">{incident.title}</h1>
              <p className="text-sm text-gray-500">{incident.type}</p>
            </div>
            <div className="flex gap-2">
              <Link href={`/admin/incidents/${incident.id}/dashboard`}
                className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm hover:bg-zinc-700">
                Command Dashboard ↗
              </Link>
              <Link href={`/incidents/${incident.id}`}
                className="rounded-lg bg-gray-800 px-3 py-1.5 text-sm hover:bg-gray-700">
                Full Incident →
              </Link>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 rounded-xl bg-zinc-900 p-1">
          {TABS.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${activeTab === tab.id ? "bg-zinc-700 text-zinc-50" : "text-zinc-500 hover:text-zinc-300"}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── COORDINATION TAB ── */}
        {activeTab === "coordination" && (
          <div className="space-y-5">
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
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold font-mono">{task.task_number}</span>
                        {task.description && <span className="text-sm text-gray-300">{task.description}</span>}
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
                          <button onClick={() => setAssigningTask(null)} className="text-xs text-gray-500 hover:text-gray-300">Done</button>
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
        )}

        {/* ── EDIT INCIDENT TAB ── */}
        {activeTab === "edit" && (
          <div className="space-y-4">
            <section className="rounded-xl bg-zinc-900 p-5 space-y-4">
              <div className="font-semibold text-zinc-50">Incident Details</div>

              <div className="space-y-1">
                <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">Title</label>
                <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded-lg bg-black px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-red-600" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">Type</label>
                  <select value={editType} onChange={(e) => setEditType(e.target.value)}
                    className="w-full rounded-lg bg-black px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-red-600">
                    {INCIDENT_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">Status</label>
                  <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full rounded-lg bg-black px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-red-600">
                    {["Active", "Closed", "Cancelled"].map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">Description</label>
                <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)}
                  rows={3} className="w-full rounded-lg bg-black px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-red-600" />
              </div>

              <div className="flex items-center justify-between rounded-lg bg-black px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-zinc-200">Accepting Units</div>
                  <div className="text-xs text-zinc-500">Members can respond to this incident</div>
                </div>
                <button onClick={() => setEditAcceptingUnits((v) => !v)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${editAcceptingUnits ? "bg-green-600" : "bg-zinc-700"}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${editAcceptingUnits ? "left-[calc(100%-1.375rem)]" : "left-0.5"}`} />
                </button>
              </div>
            </section>

            <section className="rounded-xl bg-zinc-900 p-5 space-y-4">
              <div className="font-semibold text-zinc-50">Staging Area</div>

              <div className="space-y-1">
                <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">Staging Name</label>
                <input value={editStagingName} onChange={(e) => setEditStagingName(e.target.value)}
                  placeholder="e.g. Trailhead Parking Lot"
                  className="w-full rounded-lg bg-black px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-red-600" />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">Address</label>
                <input value={editStagingAddress} onChange={(e) => setEditStagingAddress(e.target.value)}
                  placeholder="Street address"
                  className="w-full rounded-lg bg-black px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-red-600" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">Latitude</label>
                  <input value={editStagingLat} onChange={(e) => setEditStagingLat(e.target.value)}
                    placeholder="e.g. 37.7749" type="number" step="any"
                    className="w-full rounded-lg bg-black px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-red-600" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">Longitude</label>
                  <input value={editStagingLng} onChange={(e) => setEditStagingLng(e.target.value)}
                    placeholder="e.g. -122.4194" type="number" step="any"
                    className="w-full rounded-lg bg-black px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-red-600" />
                </div>
              </div>
            </section>

            <button onClick={() => void saveIncident()} disabled={saving}
              className="w-full rounded-xl bg-red-600 py-3 text-sm font-semibold disabled:opacity-60 hover:bg-red-500">
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        )}

        {/* ── POST UPDATE TAB ── */}
        {activeTab === "updates" && (
          <div className="space-y-4">
            <section className="rounded-xl bg-zinc-900 p-5 space-y-4">
              <div className="font-semibold text-zinc-50">Post Update</div>

              <div className="space-y-1">
                <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">Update Type</label>
                <select value={updateType} onChange={(e) => setUpdateType(e.target.value)}
                  className="w-full rounded-lg bg-black px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-red-600">
                  {UPDATE_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">Title</label>
                <input value={updateTitle} onChange={(e) => setUpdateTitle(e.target.value)}
                  placeholder="Update title"
                  className="w-full rounded-lg bg-black px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-red-600" />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">Details (optional)</label>
                <textarea value={updateBody} onChange={(e) => setUpdateBody(e.target.value)}
                  placeholder="Additional details…" rows={4}
                  className="w-full rounded-lg bg-black px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-red-600" />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">Notify</label>
                <div className="flex flex-wrap gap-2">
                  {([
                    { id: "all" as const, label: "All Responding" },
                    { id: "on_scene" as const, label: "On Scene Only" },
                    { id: "tasks" as const, label: "Specific Tasks" },
                  ]).map(({ id: aid, label }) => (
                    <button key={aid} onClick={() => setUpdateAudience(aid)}
                      className={`rounded-lg px-3 py-1.5 text-sm transition ${updateAudience === aid ? "bg-red-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
                      {label}
                    </button>
                  ))}
                </div>

                {updateAudience === "tasks" && (
                  <div className="space-y-1.5 pt-1">
                    <div className="text-xs text-zinc-500">Select tasks to notify:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {tasks.map((t) => {
                        const sel = selectedTaskIds.includes(t.id);
                        return (
                          <button key={t.id}
                            onClick={() => setSelectedTaskIds(sel ? selectedTaskIds.filter((x) => x !== t.id) : [...selectedTaskIds, t.id])}
                            className={`rounded-lg border px-3 py-1.5 text-sm transition ${sel ? "border-red-600 bg-red-950/40 text-red-300" : "border-zinc-700 bg-zinc-800 text-zinc-400"}`}>
                            {t.task_number}{t.description ? ` — ${t.description}` : ""}
                          </button>
                        );
                      })}
                      {tasks.length === 0 && <span className="text-sm text-zinc-600">No tasks yet.</span>}
                    </div>
                  </div>
                )}
              </div>

              <button onClick={() => void postUpdate()}
                disabled={postingUpdate || !updateTitle.trim() || (updateAudience === "tasks" && selectedTaskIds.length === 0)}
                className="w-full rounded-xl bg-red-600 py-3 text-sm font-semibold disabled:opacity-60 hover:bg-red-500">
                {postingUpdate ? "Posting…" : "Post Update"}
              </button>
            </section>
          </div>
        )}

      </div>
    </main>
  );
}
