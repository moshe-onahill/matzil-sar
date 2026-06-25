"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import { getCurrentTestEmail, getStoredRole } from "@/lib/dev-user";

type User = { id: string; full_name: string | null; call_sign: string | null };
type Assignment = { user_id: string; user: User };
type Note = { id: string; author_name: string | null; note: string; created_at: string; user_id: string };
type Task = {
  id: string;
  task_number: string;
  description: string | null;
  job_type: string | null;
  color: string | null;
  status: string;
  task_lead_id: string | null;
  task_lead?: User | null;
  assignments: Assignment[];
  notes: Note[];
};
type SiblingTask = { id: string; task_number: string; description: string | null; job_type: string | null };

const JOB_TYPES = [
  "Search Grid", "Rescue", "Evacuation", "Medical", "Cameras",
  "Drone", "Logistics", "Command", "Support", "Perimeter", "Custom",
];

const COLORS = [
  { name: "Red",    value: "red",    tw: "bg-red-500" },
  { name: "Orange", value: "orange", tw: "bg-orange-500" },
  { name: "Yellow", value: "yellow", tw: "bg-yellow-400" },
  { name: "Green",  value: "green",  tw: "bg-green-500" },
  { name: "Blue",   value: "blue",   tw: "bg-blue-500" },
  { name: "Purple", value: "purple", tw: "bg-purple-500" },
  { name: "Teal",   value: "teal",   tw: "bg-teal-500" },
  { name: "Gray",   value: "gray",   tw: "bg-zinc-500" },
];

const STATUS_OPTIONS = ["Pending", "Active", "Staging", "Cancelled", "Completed"];
const STATUS_STYLE: Record<string, string> = {
  Pending:   "bg-zinc-700/60 text-zinc-300",
  Active:    "bg-green-700/60 text-green-200",
  Staging:   "bg-blue-700/60 text-blue-200",
  Cancelled: "bg-red-900/60 text-red-300",
  Completed: "bg-zinc-800/60 text-zinc-500",
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

export default function TaskDetailPage() {
  const { id: incidentId, taskId } = useParams<{ id: string; taskId: string }>();
  const router = useRouter();
  const toast = useToast();

  const [task, setTask] = useState<Task | null>(null);
  const [siblings, setSiblings] = useState<SiblingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string | null } | null>(null);
  const isAdmin = ["SAR Manager", "Global Admin"].includes(getStoredRole());

  // Edit state
  const [editDesc, setEditDesc] = useState("");
  const [editJobType, setEditJobType] = useState("");
  const [editColor, setEditColor] = useState("");
  const [saving, setSaving] = useState(false);

  // Unit search
  const [unitSearch, setUnitSearch] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Note
  const [newNote, setNewNote] = useState("");
  const [postingNote, setPostingNote] = useState(false);

  // Combine
  const [combineWith, setCombineWith] = useState("");
  const [newLeadId, setNewLeadId] = useState("");
  const [combining, setCombining] = useState(false);

  useEffect(() => {
    void loadAll();
    void loadCurrentUser();
  }, [taskId]);

  async function loadCurrentUser() {
    const email = getCurrentTestEmail();
    if (!email) return;
    const { data } = await supabase.from("users").select("id,full_name,call_sign").eq("email", email).single();
    if (data) setCurrentUser({ id: data.id, name: data.call_sign ?? data.full_name ?? null });
  }

  async function loadAll() {
    const [taskRes, siblingsRes] = await Promise.all([
      supabase.from("incident_tasks").select(`
        id, task_number, description, job_type, color, status, task_lead_id,
        task_lead:users!incident_tasks_task_lead_id_fkey ( id, full_name, call_sign ),
        assignments:task_assignments ( user_id, user:users ( id, full_name, call_sign ) ),
        notes:task_notes ( id, user_id, author_name, note, created_at )
      `).eq("id", taskId).single(),
      supabase.from("incident_tasks").select("id,task_number,description,job_type")
        .eq("incident_id", incidentId).neq("id", taskId).order("task_number"),
    ]);

    if (!taskRes.data) { setLoading(false); return; }

    const raw = taskRes.data as any;
    const t: Task = {
      ...raw,
      task_lead: Array.isArray(raw.task_lead) ? raw.task_lead[0] ?? null : raw.task_lead,
      assignments: (raw.assignments ?? []).map((a: any) => ({
        user_id: a.user_id,
        user: Array.isArray(a.user) ? a.user[0] : a.user,
      })),
      notes: (raw.notes ?? []).sort((a: Note, b: Note) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      ),
    };
    setTask(t);
    setEditDesc(t.description ?? "");
    setEditJobType(t.job_type ?? "");
    setEditColor(t.color ?? "");
    setSiblings((siblingsRes.data ?? []) as SiblingTask[]);
    setLoading(false);
  }

  async function saveDetails() {
    setSaving(true);
    try {
      await taskApi({ action: "update_task", task_id: taskId, description: editDesc || null, job_type: editJobType || null, color: editColor || null });
      toast("Saved.", "success");
      await loadAll();
    } catch (e: any) { toast(e.message, "error"); }
    setSaving(false);
  }

  async function setStatus(status: string) {
    try { await taskApi({ action: "set_status", task_id: taskId, status }); await loadAll(); }
    catch (e: any) { toast(e.message, "error"); }
  }

  async function removeUnit(userId: string) {
    try { await taskApi({ action: "remove_unit", task_id: taskId, user_id: userId }); await loadAll(); }
    catch (e: any) { toast(e.message, "error"); }
  }

  async function setLead(userId: string | null) {
    try { await taskApi({ action: "set_lead", task_id: taskId, user_id: userId }); await loadAll(); }
    catch (e: any) { toast(e.message, "error"); }
  }

  async function addNote() {
    if (!newNote.trim() || !currentUser) return;
    setPostingNote(true);
    try {
      await taskApi({ action: "add_note", task_id: taskId, user_id: currentUser.id, author_name: currentUser.name, note: newNote.trim() });
      setNewNote("");
      toast("Note added.", "success");
      await loadAll();
    } catch (e: any) { toast(e.message, "error"); }
    setPostingNote(false);
  }

  async function deleteNote(noteId: string) {
    try { await taskApi({ action: "delete_note", note_id: noteId }); await loadAll(); }
    catch (e: any) { toast(e.message, "error"); }
  }

  async function combineTask() {
    if (!combineWith) return;
    if (!window.confirm(`Combine tasks? The other task will be deleted and its members moved here.`)) return;
    setCombining(true);
    try {
      await taskApi({ action: "combine_tasks", source_task_id: combineWith, target_task_id: taskId, new_lead_id: newLeadId || null });
      toast("Tasks combined.", "success");
      await loadAll();
      setCombineWith("");
      setNewLeadId("");
    } catch (e: any) { toast(e.message, "error"); }
    setCombining(false);
  }

  async function deleteTask() {
    if (!window.confirm(`Delete ${task?.task_number}? This cannot be undone.`)) return;
    try {
      await taskApi({ action: "delete_task", task_id: taskId });
      router.push(`/admin/incidents/${incidentId}`);
    } catch (e: any) { toast(e.message, "error"); }
  }

  function onSearchChange(val: string) {
    setUnitSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!val.trim()) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase.from("users")
        .select("id,full_name,call_sign")
        .or(`full_name.ilike.%${val}%,call_sign.ilike.%${val}%`)
        .limit(8);
      const assignedIds = new Set(task?.assignments.map((a) => a.user_id) ?? []);
      setSearchResults(((data ?? []) as User[]).filter((u) => !assignedIds.has(u.id)));
      setSearching(false);
    }, 300);
  }

  async function assignFromSearch(user: User) {
    try {
      await taskApi({ action: "assign_unit", task_id: taskId, user_id: user.id });
      setUnitSearch("");
      setSearchResults([]);
      toast(`${user.call_sign ?? user.full_name} assigned.`, "success");
      await loadAll();
    } catch (e: any) { toast(e.message, "error"); }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-red-500" />
      </main>
    );
  }

  if (!task) {
    return <main className="p-6"><p className="text-zinc-500">Task not found.</p></main>;
  }

  const colorDot = COLORS.find((c) => c.value === task.color);
  const isLead = currentUser?.id === task.task_lead_id;
  const canAddNote = isAdmin || isLead;

  return (
    <main className="p-6 lg:p-8">
      <div className="mx-auto max-w-2xl space-y-5">

        {/* Header */}
        <div>
          <Link href={`/admin/incidents/${incidentId}`} className="text-sm text-zinc-500 hover:text-zinc-300">← Back to Incident</Link>
          <div className="mt-2 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {colorDot && <div className={`h-4 w-4 rounded-full shrink-0 ${colorDot.tw}`} />}
              <h1 className="text-2xl font-bold text-zinc-50 font-mono">{task.task_number}</h1>
              <span className={`rounded-lg px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[task.status] ?? "bg-zinc-800 text-zinc-400"}`}>
                {task.status}
              </span>
            </div>
            <button onClick={() => void deleteTask()} className="text-xs text-red-500 hover:text-red-400 shrink-0">
              Delete Task
            </button>
          </div>
          {(task.job_type || task.description) && (
            <p className="mt-1 text-zinc-400">{task.job_type}{task.description ? (task.job_type ? ` — ${task.description}` : task.description) : ""}</p>
          )}
        </div>

        {/* Status */}
        <section className="rounded-xl bg-zinc-900 p-4 space-y-2">
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Status</div>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((s) => (
              <button key={s} onClick={() => void setStatus(s)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${task.status === s ? "ring-2 ring-white/30 " + (STATUS_STYLE[s] ?? "") : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"}`}>
                {s}
              </button>
            ))}
          </div>
        </section>

        {/* Details / Edit */}
        <section className="rounded-xl bg-zinc-900 p-4 space-y-3">
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Task Details</div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-500">Job Type</label>
            <div className="flex flex-wrap gap-1.5">
              {JOB_TYPES.map((j) => (
                <button key={j} onClick={() => setEditJobType(editJobType === j && j !== "Custom" ? "" : j)}
                  className={`rounded-lg px-3 py-1 text-sm transition ${editJobType === j ? "bg-red-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
                  {j}
                </button>
              ))}
            </div>
            {editJobType === "Custom" && (
              <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)}
                placeholder="Custom job description"
                className="w-full rounded-lg bg-black px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-red-600" />
            )}
          </div>

          {editJobType !== "Custom" && (
            <div className="space-y-1">
              <label className="text-xs text-zinc-500">Description (optional)</label>
              <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)}
                placeholder="Additional details"
                className="w-full rounded-lg bg-black px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-red-600" />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs text-zinc-500">Color</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button key={c.value} onClick={() => setEditColor(editColor === c.value ? "" : c.value)}
                  className={`h-7 w-7 rounded-full transition ${c.tw} ${editColor === c.value ? "ring-2 ring-white ring-offset-2 ring-offset-zinc-900" : "opacity-60 hover:opacity-100"}`}
                  title={c.name} />
              ))}
            </div>
          </div>

          <button onClick={() => void saveDetails()} disabled={saving}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold disabled:opacity-60 hover:bg-red-500">
            {saving ? "Saving…" : "Save Details"}
          </button>
        </section>

        {/* Units */}
        <section className="rounded-xl bg-zinc-900 p-4 space-y-3">
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Assigned Units ({task.assignments.length})
          </div>

          {task.assignments.length > 0 && (
            <div className="space-y-1.5">
              {task.assignments.map((a) => (
                <div key={a.user_id} className="flex items-center justify-between gap-2 rounded-lg bg-zinc-800 px-3 py-2">
                  <div className="flex items-center gap-2">
                    {task.task_lead_id === a.user_id && <span className="text-yellow-400 text-xs">★</span>}
                    <span className="font-mono text-sm text-zinc-100">{a.user?.call_sign ?? a.user?.full_name ?? "?"}</span>
                    {a.user?.full_name && a.user?.call_sign && (
                      <span className="text-xs text-zinc-500">{a.user.full_name}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => void setLead(task.task_lead_id === a.user_id ? null : a.user_id)}
                      className={`text-xs px-2 py-0.5 rounded transition ${task.task_lead_id === a.user_id ? "bg-yellow-600 text-white" : "text-zinc-500 hover:text-yellow-400"}`}>
                      {task.task_lead_id === a.user_id ? "Lead" : "Set Lead"}
                    </button>
                    <button onClick={() => void removeUnit(a.user_id)} className="text-zinc-600 hover:text-red-400 text-lg leading-none">×</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Search any user */}
          <div className="space-y-1.5">
            <div className="relative">
              <input value={unitSearch} onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search by name or call sign…"
                className="w-full rounded-lg bg-black px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-red-600" />
              {searching && (
                <div className="absolute right-3 top-2.5 h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-300" />
              )}
            </div>
            {searchResults.length > 0 && (
              <div className="rounded-lg border border-zinc-700 bg-zinc-800 divide-y divide-zinc-700 overflow-hidden">
                {searchResults.map((u) => (
                  <button key={u.id} onClick={() => void assignFromSearch(u)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-zinc-700 transition">
                    <span className="font-mono text-sm text-zinc-100">{u.call_sign ?? "—"}</span>
                    <span className="text-sm text-zinc-400">{u.full_name}</span>
                    <span className="ml-auto text-xs text-red-400">Assign +</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Notes */}
        <section className="rounded-xl bg-zinc-900 p-4 space-y-3">
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Notes {!canAddNote && <span className="ml-1 text-zinc-700">(admin / lead only)</span>}
          </div>

          {task.notes.length === 0 && (
            <p className="text-sm text-zinc-600">No notes yet.</p>
          )}
          {task.notes.map((n) => (
            <div key={n.id} className="rounded-lg bg-zinc-800 p-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-zinc-400">{n.author_name ?? "Admin"}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-600">
                    {new Date(n.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {isAdmin && (
                    <button onClick={() => void deleteNote(n.id)} className="text-zinc-600 hover:text-red-400 text-sm">×</button>
                  )}
                </div>
              </div>
              <p className="text-sm text-zinc-200 whitespace-pre-wrap">{n.note}</p>
            </div>
          ))}

          {canAddNote && (
            <div className="flex gap-2">
              <textarea value={newNote} onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a note…" rows={2}
                className="flex-1 rounded-lg bg-black px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-red-600 resize-none" />
              <button onClick={() => void addNote()} disabled={postingNote || !newNote.trim()}
                className="self-end rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold disabled:opacity-60 hover:bg-red-500 shrink-0">
                {postingNote ? "…" : "Add"}
              </button>
            </div>
          )}
        </section>

        {/* Combine tasks */}
        {isAdmin && siblings.length > 0 && (
          <section className="rounded-xl bg-zinc-900 p-4 space-y-3">
            <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Combine with Another Task</div>
            <p className="text-xs text-zinc-600">The selected task's members will be moved here and that task deleted.</p>

            <select value={combineWith} onChange={(e) => { setCombineWith(e.target.value); setNewLeadId(""); }}
              className="w-full rounded-lg bg-black px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-red-600">
              <option value="">Select task to absorb…</option>
              {siblings.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.task_number}{s.job_type ? ` — ${s.job_type}` : s.description ? ` — ${s.description}` : ""}
                </option>
              ))}
            </select>

            {combineWith && (
              <>
                <div className="space-y-1">
                  <label className="text-xs text-zinc-500">New lead after combining (optional)</label>
                  <select value={newLeadId} onChange={(e) => setNewLeadId(e.target.value)}
                    className="w-full rounded-lg bg-black px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-red-600">
                    <option value="">Keep current lead</option>
                    {task.assignments.map((a) => (
                      <option key={a.user_id} value={a.user_id}>
                        {a.user?.call_sign ?? a.user?.full_name ?? "?"}
                      </option>
                    ))}
                  </select>
                </div>
                <button onClick={() => void combineTask()} disabled={combining}
                  className="w-full rounded-xl border border-red-800 bg-red-950/40 py-2 text-sm font-semibold text-red-300 hover:bg-red-950/80 disabled:opacity-60">
                  {combining ? "Combining…" : "Combine Tasks"}
                </button>
              </>
            )}
          </section>
        )}

      </div>
    </main>
  );
}
