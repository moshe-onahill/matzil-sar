"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import { getCurrentTestEmail, getStoredRole } from "@/lib/dev-user";
import { logAudit } from "@/lib/audit";

type User = { id: string; full_name: string | null; call_sign: string | null };
type OnSceneUnit = User & { response_type: string; eta_minutes: number | null; responded_at: string };
type Assignment = { user_id: string; user: User };
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
  job_id: string | null;
};
type StagingArea = {
  id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  notes: string | null;
};

type IncidentUpdate = {
  id: string;
  update_type: string;
  title: string;
  body: string | null;
  created_at: string;
  audience: string | null;
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
  coordinator_id: string | null;
};

const JOB_TYPES = [
  "Search Grid", "Rescue", "Evacuation", "Medical", "Cameras",
  "Drone", "Logistics", "Command", "Support", "Perimeter",
];

const COLOR_DOT: Record<string, string> = {
  red: "bg-red-500", orange: "bg-orange-500", yellow: "bg-yellow-400",
  green: "bg-green-500", blue: "bg-blue-500", purple: "bg-purple-500",
  teal: "bg-teal-500", gray: "bg-zinc-500",
};

const STATUS_BADGE: Record<string, string> = {
  Pending:   "bg-zinc-700/60 text-zinc-400",
  Active:    "bg-green-800/60 text-green-300",
  Staging:   "bg-blue-800/60 text-blue-300",
  Cancelled: "bg-red-900/60 text-red-400",
  Completed: "bg-zinc-800/60 text-zinc-500",
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


type ActiveTab = "coordination" | "edit" | "updates" | "subject" | "attachments";

type Subject = {
  id: string;
  full_name: string | null;
  also_known_as: string | null;
  date_of_birth: string | null;
  age_estimate: string | null;
  gender: string | null;
  nationality: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  hair_color: string | null;
  hair_length: string | null;
  eye_color: string | null;
  skin_tone: string | null;
  build: string | null;
  distinguishing_features: string | null;
  last_seen_wearing: string | null;
  last_seen_location: string | null;
  last_seen_at: string | null;
  last_contact_at: string | null;
  medical_conditions: string | null;
  medications: string | null;
  mental_health_notes: string | null;
  mobility: string | null;
  languages_spoken: string | null;
  photo_url: string | null;
  notes: string | null;
};

export default function IncidentCoordinationPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();

  const [incident, setIncident] = useState<Incident | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [onScene, setOnScene] = useState<OnSceneUnit[]>([]);
  const [updates, setUpdates] = useState<IncidentUpdate[]>([]);
  const [editingUpdateId, setEditingUpdateId] = useState<string | null>(null);
  const [editUpdateTitle, setEditUpdateTitle] = useState("");
  const [editUpdateBody, setEditUpdateBody] = useState("");
  const [editUpdateAudience, setEditUpdateAudience] = useState<"all" | "on_scene" | "tasks">("all");
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>("coordination");

  // Current user id for posting updates
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // New task form
  const [newDesc, setNewDesc] = useState("");
  const [newJobType, setNewJobType] = useState("");
  const [creating, setCreating] = useState(false);

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
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [editCoordinatorId, setEditCoordinatorId] = useState<string>("");
  const [deleting, setDeleting] = useState(false);
  const isGlobalAdmin = getStoredRole() === "Global Admin";

  // Staging areas
  const [stagingAreas, setStagingAreas] = useState<StagingArea[]>([]);
  const [newAreaName, setNewAreaName] = useState("");
  const [newAreaAddress, setNewAreaAddress] = useState("");
  const [newAreaLat, setNewAreaLat] = useState("");
  const [newAreaLng, setNewAreaLng] = useState("");
  const [newAreaNotes, setNewAreaNotes] = useState("");
  const [addingArea, setAddingArea] = useState(false);

  // Subject / missing person
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectForm, setSubjectForm] = useState<Partial<Subject>>({});
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [savingSubject, setSavingSubject] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [heightInInput, setHeightInInput] = useState("");
  const [weightLbsInput, setWeightLbsInput] = useState("");

  // Attachments
  type Attachment = { id: string; file_name: string; file_url: string; mime_type: string | null; file_size: number | null; created_at: string };
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Jobs
  type Job = { id: string; name: string; description: string | null; created_at: string };
  const [jobs, setJobs] = useState<Job[]>([]);
  const [newJobName, setNewJobName] = useState("");
  const [newJobDesc, setNewJobDesc] = useState("");
  const [addingJob, setAddingJob] = useState(false);

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
    const [incRes, tasksRes, responsesRes, updatesRes, usersRes, areasRes, subjectsRes, attachmentsRes, jobsRes] = await Promise.all([
      supabase.from("incidents").select(
        "id,title,incident_number,type,status,short_description,accepting_units,staging_name,staging_address,staging_lat,staging_lng,coordinator_id"
      ).eq("id", id).single(),
      supabase.from("incident_tasks").select(`
        id, task_number, description, job_type, color, status, task_lead_id, job_id,
        task_lead:users!incident_tasks_task_lead_id_fkey ( id, full_name, call_sign ),
        assignments:task_assignments ( user_id, user:users ( id, full_name, call_sign ) )
      `).eq("incident_id", id).order("task_number"),
      supabase.from("incident_responses")
        .select("user_id, response_type, eta_minutes, responded_at, users ( id, full_name, call_sign )")
        .eq("incident_id", id)
        .in("response_type", ["On Location", "Responding"]),
      supabase.from("incident_updates")
        .select("id,update_type,title,body,created_at,audience")
        .eq("incident_id", id)
        .order("created_at", { ascending: false }),
      supabase.from("users").select("id,full_name,call_sign").order("call_sign"),
      supabase.from("incident_staging_areas").select("id,name,address,lat,lng,notes").eq("incident_id", id).order("created_at"),
      supabase.from("incident_subjects").select("*").eq("incident_id", id).order("created_at"),
      supabase.from("incident_attachments").select("id,file_name,file_url,mime_type,file_size,created_at").eq("incident_id", id).order("created_at", { ascending: false }),
      supabase.from("incident_jobs").select("id,name,description,created_at").eq("incident_id", id).order("created_at"),
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
      setEditCoordinatorId(inc.coordinator_id ?? "");
    }
    setAllUsers((usersRes.data ?? []) as User[]);

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
    setUpdates((updatesRes.data ?? []) as IncidentUpdate[]);
    setStagingAreas((areasRes.data ?? []) as StagingArea[]);
    setSubjects((subjectsRes.data ?? []) as Subject[]);
    setAttachments((attachmentsRes.data ?? []) as Attachment[]);
    setJobs((jobsRes.data ?? []) as Job[]);
    setLoading(false);
  }

  async function addJob() {
    if (!newJobName.trim()) return;
    setAddingJob(true);
    const { error } = await supabase.from("incident_jobs").insert({ incident_id: id, name: newJobName.trim(), description: newJobDesc.trim() || null });
    setAddingJob(false);
    if (error) { toast(error.message, "error"); return; }
    setNewJobName(""); setNewJobDesc("");
    await loadAll();
  }

  async function deleteJob(jobId: string) {
    if (!window.confirm("Delete this job?")) return;
    await supabase.from("incident_jobs").delete().eq("id", jobId);
    await loadAll();
  }

  async function assignTaskToJob(taskId: string, jobId: string | null) {
    await supabase.from("incident_tasks").update({ job_id: jobId }).eq("id", taskId);
    await loadAll();
  }

  async function addStagingArea() {
    if (!newAreaName.trim()) { toast("Name is required.", "error"); return; }
    setAddingArea(true);
    const { error } = await supabase.from("incident_staging_areas").insert({
      incident_id: id,
      name: newAreaName.trim(),
      address: newAreaAddress.trim() || null,
      lat: newAreaLat ? parseFloat(newAreaLat) : null,
      lng: newAreaLng ? parseFloat(newAreaLng) : null,
      notes: newAreaNotes.trim() || null,
    });
    setAddingArea(false);
    if (error) { toast(error.message, "error"); return; }
    setNewAreaName(""); setNewAreaAddress(""); setNewAreaLat(""); setNewAreaLng(""); setNewAreaNotes("");
    toast("Staging area added.", "success");
    await loadAll();
  }

  async function deleteStagingArea(areaId: string) {
    const { error } = await supabase.from("incident_staging_areas").delete().eq("id", areaId);
    if (error) { toast(error.message, "error"); return; }
    await loadAll();
  }

  function startNewSubject() {
    setEditingSubjectId("new");
    setSubjectForm({});
    setHeightInInput("");
    setWeightLbsInput("");
  }

  function startEditSubject(s: Subject) {
    setEditingSubjectId(s.id);
    setSubjectForm({ ...s });
    setHeightInInput(s.height_cm ? String(s.height_cm) : "");
    setWeightLbsInput(s.weight_kg ? String(s.weight_kg) : "");
  }

  async function uploadSubjectPhoto(file: File): Promise<string | null> {
    setUploadingPhoto(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("subject-photos").upload(path, file, { upsert: true });
    setUploadingPhoto(false);
    if (error) { toast(`Photo upload failed: ${error.message}`, "error"); return null; }
    const { data: urlData } = supabase.storage.from("subject-photos").getPublicUrl(path);
    return urlData.publicUrl;
  }

  async function saveSubject() {
    if (!id) return;
    setSavingSubject(true);
    const payload = {
      incident_id: id,
      full_name: subjectForm.full_name?.trim() || null,
      also_known_as: subjectForm.also_known_as?.trim() || null,
      date_of_birth: subjectForm.date_of_birth || null,
      age_estimate: subjectForm.age_estimate?.trim() || null,
      gender: subjectForm.gender?.trim() || null,
      nationality: subjectForm.nationality?.trim() || null,
      height_cm: heightInInput ? parseInt(heightInInput) : null,
      weight_kg: weightLbsInput ? parseInt(weightLbsInput) : null,
      hair_color: subjectForm.hair_color?.trim() || null,
      hair_length: subjectForm.hair_length?.trim() || null,
      eye_color: subjectForm.eye_color?.trim() || null,
      skin_tone: subjectForm.skin_tone?.trim() || null,
      build: subjectForm.build?.trim() || null,
      distinguishing_features: subjectForm.distinguishing_features?.trim() || null,
      last_seen_wearing: subjectForm.last_seen_wearing?.trim() || null,
      last_seen_location: subjectForm.last_seen_location?.trim() || null,
      last_seen_at: subjectForm.last_seen_at || null,
      last_contact_at: subjectForm.last_contact_at || null,
      medical_conditions: subjectForm.medical_conditions?.trim() || null,
      medications: subjectForm.medications?.trim() || null,
      mental_health_notes: subjectForm.mental_health_notes?.trim() || null,
      mobility: subjectForm.mobility?.trim() || null,
      languages_spoken: subjectForm.languages_spoken?.trim() || null,
      photo_url: subjectForm.photo_url || null,
      notes: subjectForm.notes?.trim() || null,
      updated_at: new Date().toISOString(),
    };
    let error;
    if (editingSubjectId === "new") {
      ({ error } = await supabase.from("incident_subjects").insert(payload));
    } else {
      ({ error } = await supabase.from("incident_subjects").update(payload).eq("id", editingSubjectId!));
    }
    setSavingSubject(false);
    if (error) { toast(error.message, "error"); return; }
    toast("Subject saved.", "success");
    setEditingSubjectId(null);
    setSubjectForm({});
    await loadAll();
  }

  async function deleteSubject(subjectId: string) {
    if (!window.confirm("Remove this subject?")) return;
    const { error } = await supabase.from("incident_subjects").delete().eq("id", subjectId);
    if (error) { toast(error.message, "error"); return; }
    await loadAll();
  }

  function downloadIncidentData() {
    if (!incident) return;
    const data = {
      incident,
      tasks,
      updates,
      onScene,
      stagingAreas,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${incident.incident_number.replace(/\//g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function startEditUpdate(u: IncidentUpdate) {
    setEditingUpdateId(u.id);
    setEditUpdateTitle(u.title);
    setEditUpdateBody(u.body ?? "");
    setEditUpdateAudience((u.audience as "all" | "on_scene" | "tasks") || "all");
  }

  async function saveEditUpdate() {
    if (!editingUpdateId || !editUpdateTitle.trim()) return;
    setSavingUpdate(true);
    const { error } = await supabase.from("incident_updates")
      .update({ title: editUpdateTitle.trim(), body: editUpdateBody.trim() || null, audience: editUpdateAudience })
      .eq("id", editingUpdateId);
    if (error) { setSavingUpdate(false); toast(error.message, "error"); return; }

    // Re-send notifications to new audience
    let recipientIds: string[] = [];
    if (editUpdateAudience === "all") {
      const { data } = await supabase.from("incident_responses").select("user_id").eq("incident_id", id).in("response_type", ["Responding", "On Location"]);
      recipientIds = (data ?? []).map((r: any) => r.user_id);
    } else if (editUpdateAudience === "on_scene") {
      const { data } = await supabase.from("incident_responses").select("user_id").eq("incident_id", id).eq("response_type", "On Location");
      recipientIds = (data ?? []).map((r: any) => r.user_id);
    }
    if (recipientIds.length > 0) {
      await supabase.from("notification_logs").insert(
        recipientIds.map((uid) => ({
          user_id: uid, channel: "app", notification_type: "incident_update",
          title: `Update: ${editUpdateTitle.trim()}`, body: editUpdateBody.trim() || "Incident update",
          related_incident_id: id, status: "pending",
        }))
      );
    }

    setSavingUpdate(false);
    toast("Update saved.", "success");
    setEditingUpdateId(null);
    await loadAll();
  }

  async function deleteUpdate(updateId: string) {
    const { error } = await supabase.from("incident_updates").delete().eq("id", updateId);
    if (error) { toast(error.message, "error"); return; }
    toast("Update deleted.", "success");
    await loadAll();
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
      coordinator_id: editCoordinatorId || null,
    }).eq("id", id);
    setSaving(false);
    if (error) { toast(error.message, "error"); return; }
    toast("Incident updated.", "success");
    void logAudit({ action: "edit_incident", entity_type: "incident", entity_id: id as string, entity_label: editTitle.trim(), details: { status: editStatus } });
    await loadAll();
  }

  async function deleteIncident() {
    if (!id || !incident) return;
    if (isGlobalAdmin) {
      if (!window.confirm(`Permanently delete "${incident.title}"? This cannot be undone.`)) return;
      setDeleting(true);
      const { error } = await supabase.from("incidents").delete().eq("id", id);
      setDeleting(false);
      if (error) { toast(error.message, "error"); return; }
      void logAudit({ action: "delete_incident", entity_type: "incident", entity_id: id as string, entity_label: incident.title });
      window.location.href = "/admin/incidents";
    } else {
      if (!window.confirm(`Archive "${incident.title}"? It will be hidden but a Global Admin can restore it.`)) return;
      setDeleting(true);
      const { error } = await supabase.from("incidents").update({ is_deleted: true, deleted_at: new Date().toISOString(), deleted_by: currentUserId }).eq("id", id);
      setDeleting(false);
      if (error) { toast(error.message, "error"); return; }
      void logAudit({ action: "delete_incident", entity_type: "incident", entity_id: id as string, entity_label: incident.title });
      window.location.href = "/admin/incidents";
    }
  }

  async function uploadAttachment(file: File) {
    if (!id || !currentUserId) return;
    setUploadingFile(true);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${id}/${Date.now()}-${safeName}`;
    const { error: upErr } = await supabase.storage.from("incident-attachments").upload(path, file);
    if (upErr) { toast(upErr.message, "error"); setUploadingFile(false); return; }
    const { data: urlData } = supabase.storage.from("incident-attachments").getPublicUrl(path);
    const { error: dbErr } = await supabase.from("incident_attachments").insert({
      incident_id: id, file_url: urlData.publicUrl, file_name: file.name,
      file_size: file.size, mime_type: file.type, uploaded_by: currentUserId, category: "attachment",
    });
    setUploadingFile(false);
    if (dbErr) { toast(dbErr.message, "error"); return; }
    toast("File uploaded.", "success");
    await loadAll();
  }

  async function deleteAttachment(att: Attachment) {
    if (!window.confirm(`Delete "${att.file_name}"?`)) return;
    const storagePath = att.file_url.split("/incident-attachments/")[1];
    if (storagePath) {
      const { error: stErr } = await supabase.storage.from("incident-attachments").remove([storagePath]);
      if (stErr) { toast(`Storage error: ${stErr.message}`, "error"); return; }
    }
    const { error: dbErr } = await supabase.from("incident_attachments").delete().eq("id", att.id);
    if (dbErr) { toast(`Delete failed: ${dbErr.message}`, "error"); return; }
    toast("File deleted.", "success");
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
      audience: updateAudience,
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
      await taskApi({
        action: "create_task", incident_id: id,
        task_number: nextTaskNumber(),
        description: newDesc.trim() || null,
        job_type: newJobType || null,
      });
      setNewDesc("");
      setNewJobType("");
      toast("Task created.", "success");
      await loadAll();
    } catch (e: any) { toast(e.message, "error"); }
    setCreating(false);
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

  const TABS: { id: ActiveTab; label: string }[] = [
    { id: "coordination", label: "Coordination" },
    { id: "subject", label: "Subject" },
    { id: "attachments", label: "Files" },
    { id: "edit", label: "Edit" },
    { id: "updates", label: "Updates" },
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
            <div className="flex gap-2 flex-wrap">
              <Link href={`/admin/incidents/${incident.id}/dashboard`}
                className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm hover:bg-zinc-700">
                Command Dashboard ↗
              </Link>
              <Link href={`/flyer/${incident.id}`} target="_blank"
                className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm hover:bg-zinc-700">
                Flyer ↗
              </Link>
              <button onClick={downloadIncidentData}
                className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm hover:bg-zinc-700">
                Export ↓
              </button>
              <Link href={`/incidents/${incident.id}`}
                className="rounded-lg bg-gray-800 px-3 py-1.5 text-sm hover:bg-gray-700">
                Full Incident →
              </Link>
              {isGlobalAdmin && (
                <button onClick={() => void deleteIncident()} disabled={deleting}
                  className="rounded-lg bg-red-950 border border-red-800 px-3 py-1.5 text-sm text-red-400 hover:bg-red-900 disabled:opacity-50 transition">
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              )}
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
            {/* Coordinator */}
            {incident.coordinator_id && (() => {
              const coord = allUsers.find((u) => u.id === incident.coordinator_id);
              return coord ? (
                <section className="rounded-xl bg-zinc-900 border border-zinc-700 px-4 py-3 flex items-center gap-3">
                  <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Logistics Coordinator</span>
                  <span className="font-mono text-zinc-100 font-medium">{coord.call_sign ?? coord.full_name}</span>
                  {coord.call_sign && coord.full_name && <span className="text-zinc-400 text-sm">{coord.full_name}</span>}
                </section>
              ) : null;
            })()}

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
              <div className="flex flex-wrap gap-1.5">
                {JOB_TYPES.map((j) => (
                  <button key={j} onClick={() => setNewJobType(newJobType === j ? "" : j)}
                    className={`rounded-lg px-3 py-1 text-sm transition ${newJobType === j ? "bg-red-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
                    {j}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <div className="flex items-center rounded-lg bg-black px-3 py-2 text-sm font-mono text-gray-400 shrink-0">
                  {nextTaskNumber()}
                </div>
                <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void createTask()}
                  placeholder={newJobType ? `${newJobType} — additional details` : "Task description (optional)"}
                  className="flex-1 rounded-lg bg-black px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-red-600" />
                <button onClick={() => void createTask()} disabled={creating}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold disabled:opacity-60 hover:bg-red-500 shrink-0">
                  {creating ? "…" : "Add"}
                </button>
              </div>
            </section>

            {/* Task board — compact cards */}
            {tasks.length === 0 ? (
              <div className="rounded-xl bg-gray-900 p-8 text-center text-gray-600">No tasks yet.</div>
            ) : (
              <div className="space-y-2">
                {tasks.map((task) => {
                  const dot = task.color ? COLOR_DOT[task.color] : null;
                  const lead = task.task_lead;
                  const label = task.job_type ?? task.description ?? "";
                  return (
                    <Link key={task.id} href={`/admin/incidents/${id}/tasks/${task.id}`}
                      className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 hover:bg-zinc-800 transition">
                      {dot && <div className={`h-3 w-3 rounded-full shrink-0 ${dot}`} />}
                      <span className="font-mono font-bold text-zinc-200 shrink-0">{task.task_number}</span>
                      {label && <span className="text-sm text-zinc-400 truncate">{label}</span>}
                      <div className="ml-auto flex items-center gap-2 shrink-0">
                        {lead && (
                          <span className="text-xs text-yellow-500 font-mono">★ {lead.call_sign ?? lead.full_name}</span>
                        )}
                        <span className="text-xs text-zinc-500">{task.assignments.length} unit{task.assignments.length !== 1 ? "s" : ""}</span>
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[task.status] ?? "bg-zinc-800 text-zinc-500"}`}>
                          {task.status}
                        </span>
                        <span className="text-zinc-600 text-sm">→</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── SUBJECT / MISSING PERSON TAB ── */}
        {activeTab === "subject" && (
          <div className="space-y-4">
            {/* Subject cards */}
            {subjects.map((s) => (
              <div key={s.id} className="rounded-xl border border-zinc-700 bg-zinc-900 overflow-hidden">
                {/* Photo + name header */}
                <div className="flex items-start gap-4 p-4 border-b border-zinc-800">
                  {s.photo_url ? (
                    <img src={s.photo_url} alt={s.full_name ?? "Subject"}
                      onClick={() => setLightboxUrl(s.photo_url!)}
                      className="h-24 w-24 rounded-lg object-cover shrink-0 border border-zinc-700 cursor-zoom-in" />
                  ) : (
                    <div className="h-24 w-24 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                      <span className="text-zinc-600 text-3xl">👤</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-lg font-bold text-zinc-50">{s.full_name ?? "Unknown"}</div>
                        {s.also_known_as && <div className="text-sm text-zinc-400">AKA: {s.also_known_as}</div>}
                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-zinc-500">
                          {s.gender && <span>{s.gender}</span>}
                          {(s.date_of_birth || s.age_estimate) && <span>·</span>}
                          {s.date_of_birth && <span>DOB: {s.date_of_birth}</span>}
                          {s.age_estimate && <span>~{s.age_estimate}</span>}
                          {s.nationality && <><span>·</span><span>{s.nationality}</span></>}
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button onClick={() => startEditSubject(s)}
                          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs hover:bg-zinc-700 transition">
                          Edit
                        </button>
                        <button onClick={() => void deleteSubject(s.id)}
                          className="rounded-lg border border-red-900 bg-red-950/40 px-3 py-1.5 text-xs text-red-400 hover:bg-red-900/60 transition">
                          Remove
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-zinc-400">
                      {s.hair_color && <span>Hair: {s.hair_color}{s.hair_length ? ` (${s.hair_length})` : ""}</span>}
                      {s.eye_color && <span>Eyes: {s.eye_color}</span>}
                      {s.height_cm && <span>Height: {Math.floor(s.height_cm / 12)}′{s.height_cm % 12}″</span>}
                      {s.weight_kg && <span>Weight: {s.weight_kg} lbs</span>}
                      {s.build && <span>Build: {s.build}</span>}
                      {s.skin_tone && <span>Skin: {s.skin_tone}</span>}
                    </div>
                  </div>
                </div>
                {/* Details grid */}
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  {s.last_seen_wearing && (
                    <div className="col-span-full">
                      <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Last Seen Wearing</span>
                      <p className="mt-0.5 text-zinc-200">{s.last_seen_wearing}</p>
                    </div>
                  )}
                  {s.last_seen_location && (
                    <div>
                      <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Last Seen Location</span>
                      <p className="mt-0.5 text-zinc-200">{s.last_seen_location}</p>
                    </div>
                  )}
                  {s.last_seen_at && (
                    <div>
                      <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Last Seen</span>
                      <p className="mt-0.5 text-zinc-200">{new Date(s.last_seen_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                  )}
                  {s.distinguishing_features && (
                    <div className="col-span-full">
                      <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Distinguishing Features</span>
                      <p className="mt-0.5 text-zinc-200">{s.distinguishing_features}</p>
                    </div>
                  )}
                  {s.medical_conditions && (
                    <div className="col-span-full rounded-lg bg-yellow-950/40 border border-yellow-800/50 px-3 py-2">
                      <span className="text-xs font-medium text-yellow-500 uppercase tracking-wide">Medical Conditions</span>
                      <p className="mt-0.5 text-yellow-200">{s.medical_conditions}</p>
                    </div>
                  )}
                  {s.notes && (
                    <div className="col-span-full text-zinc-500 italic text-xs">{s.notes}</div>
                  )}
                </div>
                <div className="px-4 pb-3">
                  <a href={`/flyer/${id}`} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-200 transition">
                    🖨 View Flyer ↗
                  </a>
                </div>
              </div>
            ))}

            {/* Add / Edit form */}
            {editingSubjectId ? (
              <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-5 space-y-5">
                <div className="font-semibold text-zinc-50">
                  {editingSubjectId === "new" ? "Add Missing Person" : "Edit Subject"}
                </div>

                {/* Photo upload */}
                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">Photo</label>
                  <div className="flex items-center gap-4">
                    {subjectForm.photo_url ? (
                      <img src={subjectForm.photo_url} alt="Preview"
                        className="h-20 w-20 rounded-lg object-cover border border-zinc-700" />
                    ) : (
                      <div className="h-20 w-20 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                        <span className="text-zinc-600 text-2xl">👤</span>
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <label className={`cursor-pointer rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700 transition inline-block ${uploadingPhoto ? "opacity-50 pointer-events-none" : ""}`}>
                        {uploadingPhoto ? "Uploading…" : "Upload Photo"}
                        <input type="file" accept="image/*" className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const url = await uploadSubjectPhoto(file);
                            if (url) setSubjectForm((f) => ({ ...f, photo_url: url }));
                          }} />
                      </label>
                      {subjectForm.photo_url && (
                        <button onClick={() => setSubjectForm((f) => ({ ...f, photo_url: "" }))}
                          className="block text-xs text-zinc-600 hover:text-red-400 transition">
                          Remove photo
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Identity */}
                <div>
                  <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Identity</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { key: "full_name", label: "Full Name" },
                      { key: "also_known_as", label: "Also Known As / Nickname" },
                      { key: "age_estimate", label: "Age / Estimate" },
                      { key: "nationality", label: "Nationality" },
                      { key: "languages_spoken", label: "Languages Spoken" },
                    ].map(({ key, label }) => (
                      <div key={key} className="space-y-0.5">
                        <label className="text-xs text-zinc-500">{label}</label>
                        <input value={(subjectForm as any)[key] ?? ""}
                          onChange={(e) => setSubjectForm((f) => ({ ...f, [key]: e.target.value }))}
                          className="w-full rounded-lg bg-black px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-red-600" />
                      </div>
                    ))}
                    <div className="space-y-0.5">
                      <label className="text-xs text-zinc-500">Gender</label>
                      <select value={subjectForm.gender ?? ""}
                        onChange={(e) => setSubjectForm((f) => ({ ...f, gender: e.target.value }))}
                        className="w-full rounded-lg bg-black px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-red-600">
                        <option value="">— Select —</option>
                        {["Male","Female","Non-binary","Unknown"].map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-xs text-zinc-500">Date of Birth</label>
                      <input type="date" value={subjectForm.date_of_birth ?? ""}
                        onChange={(e) => setSubjectForm((f) => ({ ...f, date_of_birth: e.target.value }))}
                        className="w-full rounded-lg bg-black px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-red-600" />
                    </div>
                  </div>
                </div>

                {/* Physical */}
                <div>
                  <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Physical Description</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {([
                      { key: "hair_color", label: "Hair Color", opts: ["Black","Dark Brown","Brown","Light Brown","Blonde","Dirty Blonde","Auburn","Red","Gray","White","Salt & Pepper","Bald","Other"] },
                      { key: "hair_length", label: "Hair Length", opts: ["Bald","Buzzed","Short","Medium","Long","Very Long"] },
                      { key: "eye_color", label: "Eye Color", opts: ["Brown","Dark Brown","Hazel","Green","Blue","Gray","Amber","Black","Other"] },
                      { key: "skin_tone", label: "Skin Tone", opts: ["Fair","Light","Medium","Olive","Tan","Brown","Dark Brown","Dark","Other"] },
                      { key: "build", label: "Build", opts: ["Slim","Slender","Average","Medium","Athletic","Muscular","Stocky","Heavy","Large","Obese"] },
                    ] as { key: keyof typeof subjectForm; label: string; opts: string[] }[]).map(({ key, label, opts }) => (
                      <div key={key} className="space-y-0.5">
                        <label className="text-xs text-zinc-500">{label}</label>
                        <select value={(subjectForm as any)[key] ?? ""}
                          onChange={(e) => setSubjectForm((f) => ({ ...f, [key]: e.target.value }))}
                          className="w-full rounded-lg bg-black px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-red-600">
                          <option value="">— Select —</option>
                          {opts.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                    ))}
                    <div className="space-y-0.5">
                      <label className="text-xs text-zinc-500">Height (inches — e.g. 71 = 5′11″)</label>
                      <input type="number" value={heightInInput}
                        onChange={(e) => setHeightInInput(e.target.value)}
                        placeholder="71"
                        className="w-full rounded-lg bg-black px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-red-600" />
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-xs text-zinc-500">Weight (lbs)</label>
                      <input type="number" value={weightLbsInput}
                        onChange={(e) => setWeightLbsInput(e.target.value)}
                        placeholder="160"
                        className="w-full rounded-lg bg-black px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-red-600" />
                    </div>
                  </div>
                  <div className="mt-2 space-y-0.5">
                    <label className="text-xs text-zinc-500">Distinguishing Features / Tattoos / Marks</label>
                    <textarea value={subjectForm.distinguishing_features ?? ""} rows={2}
                      onChange={(e) => setSubjectForm((f) => ({ ...f, distinguishing_features: e.target.value }))}
                      className="w-full rounded-lg bg-black px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-red-600 resize-none" />
                  </div>
                </div>

                {/* Last seen */}
                <div>
                  <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Last Known</div>
                  <div className="space-y-2">
                    <div className="space-y-0.5">
                      <label className="text-xs text-zinc-500">Last Seen Wearing</label>
                      <textarea value={subjectForm.last_seen_wearing ?? ""} rows={2}
                        onChange={(e) => setSubjectForm((f) => ({ ...f, last_seen_wearing: e.target.value }))}
                        className="w-full rounded-lg bg-black px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-red-600 resize-none" />
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-xs text-zinc-500">Last Seen Location</label>
                      <input value={subjectForm.last_seen_location ?? ""}
                        onChange={(e) => setSubjectForm((f) => ({ ...f, last_seen_location: e.target.value }))}
                        className="w-full rounded-lg bg-black px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-red-600" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-0.5">
                        <label className="text-xs text-zinc-500">Last Seen (date/time)</label>
                        <input type="datetime-local" value={subjectForm.last_seen_at ? subjectForm.last_seen_at.slice(0, 16) : ""}
                          onChange={(e) => setSubjectForm((f) => ({ ...f, last_seen_at: e.target.value ? new Date(e.target.value).toISOString() : "" }))}
                          className="w-full rounded-lg bg-black px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-red-600" />
                      </div>
                      <div className="space-y-0.5">
                        <label className="text-xs text-zinc-500">Last Contact</label>
                        <input type="datetime-local" value={subjectForm.last_contact_at ? subjectForm.last_contact_at.slice(0, 16) : ""}
                          onChange={(e) => setSubjectForm((f) => ({ ...f, last_contact_at: e.target.value ? new Date(e.target.value).toISOString() : "" }))}
                          className="w-full rounded-lg bg-black px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-red-600" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Medical */}
                <div>
                  <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Medical / Behavioral</div>
                  <div className="space-y-2">
                    {[
                      { key: "medical_conditions", label: "Medical Conditions", rows: 2 },
                      { key: "medications", label: "Medications", rows: 1 },
                      { key: "mental_health_notes", label: "Mental Health / Behavioral Notes", rows: 2 },
                      { key: "mobility", label: "Mobility / Physical Limitations", rows: 1 },
                    ].map(({ key, label, rows }) => (
                      <div key={key} className="space-y-0.5">
                        <label className="text-xs text-zinc-500">{label}</label>
                        <textarea value={(subjectForm as any)[key] ?? ""} rows={rows}
                          onChange={(e) => setSubjectForm((f) => ({ ...f, [key]: e.target.value }))}
                          className="w-full rounded-lg bg-black px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-red-600 resize-none" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-0.5">
                  <label className="text-xs text-zinc-500">Additional Notes</label>
                  <textarea value={subjectForm.notes ?? ""} rows={2}
                    onChange={(e) => setSubjectForm((f) => ({ ...f, notes: e.target.value }))}
                    className="w-full rounded-lg bg-black px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-red-600 resize-none" />
                </div>

                <div className="flex gap-2">
                  <button onClick={() => void saveSubject()} disabled={savingSubject}
                    className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-semibold disabled:opacity-60 hover:bg-red-500 transition">
                    {savingSubject ? "Saving…" : "Save Subject"}
                  </button>
                  <button onClick={() => { setEditingSubjectId(null); setSubjectForm({}); setHeightInInput(""); setWeightLbsInput(""); }}
                    className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm hover:bg-zinc-700 transition">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={startNewSubject}
                className="w-full rounded-xl border-2 border-dashed border-zinc-700 py-4 text-sm text-zinc-500 hover:border-red-600 hover:text-zinc-300 transition">
                + Add Missing Person
              </button>
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

            <section className="rounded-xl bg-zinc-900 p-5 space-y-2">
              <div className="font-semibold text-zinc-50">Logistics Coordinator</div>
              <select value={editCoordinatorId} onChange={(e) => setEditCoordinatorId(e.target.value)}
                className="w-full rounded-lg bg-black px-3 py-2.5 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-red-600">
                <option value="">— None —</option>
                {allUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.call_sign ?? u.full_name ?? u.id}</option>
                ))}
              </select>
            </section>

            <button onClick={() => void saveIncident()} disabled={saving}
              className="w-full rounded-xl bg-red-600 py-3 text-sm font-semibold disabled:opacity-60 hover:bg-red-500">
              {saving ? "Saving…" : "Save Changes"}
            </button>

            {/* Additional Staging Areas */}
            <section className="rounded-xl bg-zinc-900 p-5 space-y-4">
              <div className="font-semibold text-zinc-50">Additional Staging Areas</div>

              {stagingAreas.length > 0 && (
                <div className="space-y-2">
                  {stagingAreas.map((area) => (
                    <div key={area.id} className="flex items-start justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-zinc-200">{area.name}</div>
                        {area.address && <div className="text-xs text-zinc-500">{area.address}</div>}
                        {area.lat != null && area.lng != null && (
                          <div className="text-xs text-zinc-600 font-mono">{area.lat.toFixed(5)}, {area.lng.toFixed(5)}</div>
                        )}
                        {area.notes && <div className="text-xs text-zinc-600 italic">{area.notes}</div>}
                      </div>
                      <button onClick={() => void deleteStagingArea(area.id)}
                        className="shrink-0 text-xs text-zinc-600 hover:text-red-400 transition px-2 py-1">
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2 rounded-lg bg-zinc-800/50 p-3">
                <div className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Add Staging Area</div>
                <input value={newAreaName} onChange={(e) => setNewAreaName(e.target.value)}
                  placeholder="Name *"
                  className="w-full rounded-lg bg-black px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-red-600" />
                <input value={newAreaAddress} onChange={(e) => setNewAreaAddress(e.target.value)}
                  placeholder="Address (optional)"
                  className="w-full rounded-lg bg-black px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-red-600" />
                <div className="grid grid-cols-2 gap-2">
                  <input value={newAreaLat} onChange={(e) => setNewAreaLat(e.target.value)}
                    placeholder="Latitude" type="number" step="any"
                    className="w-full rounded-lg bg-black px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-red-600" />
                  <input value={newAreaLng} onChange={(e) => setNewAreaLng(e.target.value)}
                    placeholder="Longitude" type="number" step="any"
                    className="w-full rounded-lg bg-black px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-red-600" />
                </div>
                <input value={newAreaNotes} onChange={(e) => setNewAreaNotes(e.target.value)}
                  placeholder="Notes (optional)"
                  className="w-full rounded-lg bg-black px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-red-600" />
                <button onClick={() => void addStagingArea()} disabled={addingArea}
                  className="w-full rounded-lg bg-zinc-700 py-2 text-sm font-medium hover:bg-zinc-600 disabled:opacity-60 transition">
                  {addingArea ? "Adding…" : "+ Add"}
                </button>
              </div>
            </section>

            {/* Jobs */}
            <section className="rounded-xl bg-zinc-900 p-5 space-y-4">
              <div className="font-semibold text-zinc-50">Jobs</div>
              <p className="text-xs text-zinc-500">Define objectives and assign tasks to each job.</p>

              {jobs.length > 0 && (
                <div className="space-y-3">
                  {jobs.map((job) => {
                    const jobTasks = tasks.filter((t) => t.job_id === job.id);
                    const unassignedTasks = tasks.filter((t) => !t.job_id);
                    return (
                      <div key={job.id} className="rounded-lg border border-zinc-700 bg-zinc-950 p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-medium text-zinc-100">{job.name}</div>
                            {job.description && <div className="text-xs text-zinc-500 mt-0.5">{job.description}</div>}
                          </div>
                          <button onClick={() => void deleteJob(job.id)} className="text-zinc-600 hover:text-red-400 text-sm shrink-0">×</button>
                        </div>
                        <div className="space-y-1.5">
                          {jobTasks.map((t) => (
                            <div key={t.id} className="flex items-center justify-between gap-2 rounded bg-zinc-800 px-3 py-1.5">
                              <span className="font-mono text-xs text-zinc-200">{t.task_number} {t.job_type ? `— ${t.job_type}` : t.description ? `— ${t.description}` : ""}</span>
                              <button onClick={() => void assignTaskToJob(t.id, null)} className="text-xs text-zinc-600 hover:text-red-400">Remove</button>
                            </div>
                          ))}
                          {unassignedTasks.length > 0 && (
                            <select defaultValue="" onChange={(e) => { if (e.target.value) void assignTaskToJob(e.target.value, job.id); e.target.value = ""; }}
                              className="w-full rounded-lg bg-black px-3 py-2 text-xs text-zinc-400 outline-none focus:ring-1 focus:ring-red-600">
                              <option value="">+ Assign task…</option>
                              {unassignedTasks.map((t) => (
                                <option key={t.id} value={t.id}>{t.task_number}{t.job_type ? ` — ${t.job_type}` : t.description ? ` — ${t.description}` : ""}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                <input value={newJobName} onChange={(e) => setNewJobName(e.target.value)}
                  placeholder="Job name (e.g. Sector A Search)"
                  className="w-full rounded-lg bg-black px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-red-600" />
                <input value={newJobDesc} onChange={(e) => setNewJobDesc(e.target.value)}
                  placeholder="Description (optional)"
                  className="w-full rounded-lg bg-black px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-red-600" />
                <button onClick={() => void addJob()} disabled={addingJob || !newJobName.trim()}
                  className="w-full rounded-lg bg-zinc-700 py-2 text-sm font-medium hover:bg-zinc-600 disabled:opacity-60 transition">
                  {addingJob ? "Adding…" : "+ Add Job"}
                </button>
              </div>
            </section>
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

            {/* Existing updates */}
            {updates.length > 0 && (
              <section className="rounded-xl bg-zinc-900 p-5 space-y-3">
                <div className="font-semibold text-zinc-100">Posted Updates</div>
                <div className="space-y-2">
                  {updates.map((u) => (
                    <div key={u.id} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                      {editingUpdateId === u.id ? (
                        <div className="space-y-2">
                          <div className="text-xs text-zinc-500">{u.update_type} · {new Date(u.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
                          <input value={editUpdateTitle} onChange={(e) => setEditUpdateTitle(e.target.value)}
                            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500" />
                          <textarea value={editUpdateBody} onChange={(e) => setEditUpdateBody(e.target.value)} rows={3}
                            placeholder="Body (optional)"
                            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500 resize-none" />
                          <div>
                            <div className="text-xs text-zinc-500 mb-1">Re-send to</div>
                            <div className="flex gap-1.5">
                              {(["all", "on_scene"] as const).map((a) => (
                                <button key={a} type="button" onClick={() => setEditUpdateAudience(a)}
                                  className={`rounded-lg px-3 py-1 text-xs transition ${editUpdateAudience === a ? "bg-red-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
                                  {a === "all" ? "All Units" : "On Scene"}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => void saveEditUpdate()} disabled={savingUpdate}
                              className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60 hover:bg-green-500">
                              {savingUpdate ? "Saving…" : "Save"}
                            </button>
                            <button onClick={() => setEditingUpdateId(null)}
                              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-medium text-red-400">{u.update_type}</span>
                              <span className="text-xs text-zinc-600">
                                {new Date(u.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                            <div className="mt-0.5 text-sm font-medium text-zinc-200">{u.title}</div>
                            {u.body && <div className="mt-1 text-xs text-zinc-500">{u.body}</div>}
                            {u.audience && u.audience !== "all" && (
                              <div className="mt-1 text-xs text-zinc-600">Sent to: {u.audience === "on_scene" ? "On Scene" : u.audience}</div>
                            )}
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <button onClick={() => startEditUpdate(u)}
                              className="text-xs text-zinc-600 hover:text-zinc-300 transition px-2 py-1">Edit</button>
                            <button onClick={() => void deleteUpdate(u.id)}
                              className="text-xs text-zinc-700 hover:text-red-400 transition px-2 py-1">Delete</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* ── ATTACHMENTS TAB ── */}
        {activeTab === "attachments" && (
          <div className="space-y-4">
            <section className="rounded-xl bg-zinc-900 p-5 space-y-4">
              <div className="font-semibold text-zinc-50">Incident Files</div>
              <div className="text-sm text-zinc-500">All members can view. Only admins/managers can upload or delete.</div>

              {isGlobalAdmin || ["SAR Manager", "Dispatcher"].includes(getStoredRole()) ? (
                <label className={`flex items-center justify-center gap-2 w-full rounded-xl border-2 border-dashed border-zinc-700 py-6 cursor-pointer hover:border-zinc-500 transition ${uploadingFile ? "opacity-50 pointer-events-none" : ""}`}>
                  <span className="text-sm text-zinc-400">{uploadingFile ? "Uploading…" : "Click to upload PDF or image (max 50 MB)"}</span>
                  <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadAttachment(f); e.target.value = ""; }} />
                </label>
              ) : null}

              {attachments.length === 0 ? (
                <div className="rounded-lg bg-black/30 p-4 text-sm text-zinc-500">No files attached yet.</div>
              ) : (
                <div className="space-y-2">
                  {attachments.map((att) => {
                    const isPdf = att.mime_type === "application/pdf";
                    return (
                      <div key={att.id} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-zinc-200">{att.file_name}</div>
                          <div className="text-xs text-zinc-600 mt-0.5">
                            {att.file_size ? `${(att.file_size / 1024).toFixed(0)} KB · ` : ""}
                            {new Date(att.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <a href={att.file_url} target="_blank" rel="noopener noreferrer"
                            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 transition">
                            {isPdf ? "Open PDF" : "View"}
                          </a>
                          {(isGlobalAdmin || ["SAR Manager", "Dispatcher"].includes(getStoredRole())) && (
                            <button onClick={() => void deleteAttachment(att)}
                              className="rounded-lg px-3 py-1.5 text-xs text-zinc-600 hover:text-red-400 transition">
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

      </div>

      {lightboxUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="Subject photo" className="max-h-full max-w-full rounded-xl object-contain shadow-2xl" onClick={(e) => e.stopPropagation()} />
          <button onClick={() => setLightboxUrl(null)} className="absolute top-4 right-4 rounded-full bg-zinc-800 p-2 text-zinc-300 hover:bg-zinc-700 transition">✕</button>
        </div>
      )}
    </main>
  );
}
