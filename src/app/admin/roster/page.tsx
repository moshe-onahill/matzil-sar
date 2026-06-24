"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import { logAudit } from "@/lib/audit";

type Role = { id: string; name: string };
type Unit = { id: string; name: string };

type Member = {
  id: string;
  email: string;
  full_name: string | null;
  call_sign: string | null;
  phone: string | null;
  home_address: string | null;
  car_make: string | null;
  car_model: string | null;
  car_color: string | null;
  license_plate_state: string | null;
  license_plate_number: string | null;
  is_active: boolean | null;
  is_on_duty: boolean | null;
  is_invited: boolean | null;
  created_at: string;
  roles: string[];
  units: string[];
};

type Certification = {
  id: string;
  name: string;
  expires_at: string | null;
};

type ChangeRequest = {
  id: string;
  user_id: string;
  field_name: string;
  old_value: string | null;
  new_value: string;
  status: "pending" | "approved" | "rejected";
  admin_note: string | null;
  created_at: string;
  users: { full_name: string | null; call_sign: string | null; email: string };
};

type EditState = {
  full_name: string;
  call_sign: string;
  phone: string;
  home_address: string;
  car_make: string;
  car_model: string;
  car_color: string;
  license_plate_state: string;
  license_plate_number: string;
  is_active: boolean;
  is_on_duty: boolean;
  roles: string[];
  units: string[];
};

export default function AdminRosterPage() {
  const toast = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [allUnits, setAllUnits] = useState<Unit[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("active");
  const [certsForMember, setCertsForMember] = useState<Member | null>(null);
  const [tab, setTab] = useState<"roster" | "requests" | "bulk">("roster");
  const [bulkEdits, setBulkEdits] = useState<Record<string, EditState>>({});
  const [bulkSaving, setBulkSaving] = useState(false);
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviting, setInviting] = useState(false);

  useEffect(() => { void loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [usersRes, rolesRes, unitsRes] = await Promise.all([
      supabase.from("users").select(`
        id, email, full_name, call_sign, phone,
        home_address, car_make, car_model, car_color, license_plate_state, license_plate_number,
        is_active, is_on_duty, is_invited, created_at,
        user_roles ( roles ( id, name ) ),
        user_units ( units ( id, name ) )
      `).order("full_name", { ascending: true }),
      supabase.from("roles").select("id, name").order("name"),
      supabase.from("units").select("id, name").order("name"),
    ]);

    setAllRoles((rolesRes.data as Role[]) ?? []);
    setAllUnits((unitsRes.data as Unit[]) ?? []);

    const rows = (usersRes.data ?? []).map((u: any) => ({
      ...u,
      roles: extractNames(u.user_roles ?? [], "roles"),
      units: extractNames(u.user_units ?? [], "units"),
    })) as Member[];
    setMembers(rows);

    const { data: reqData } = await supabase
      .from("profile_change_requests")
      .select("id, user_id, field_name, old_value, new_value, status, admin_note, created_at, users(full_name, call_sign, email)")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    setChangeRequests((reqData as unknown as ChangeRequest[]) ?? []);

    setLoading(false);
  }

  async function approveRequest(req: ChangeRequest) {
    setActionLoading(req.id);
    const updateField: Record<string, string> = { [req.field_name]: req.new_value };
    const { error } = await supabase.from("users").update(updateField).eq("id", req.user_id);
    if (error) { toast(error.message, "error"); setActionLoading(null); return; }
    await supabase.from("profile_change_requests").update({ status: "approved", reviewed_at: new Date().toISOString() }).eq("id", req.id);
    toast("Approved and applied.", "success");
    void logAudit({ action: "approve_change_request", entity_type: "user", entity_id: req.user_id, details: { field: req.field_name, old: req.old_value, new: req.new_value } });
    setActionLoading(null);
    void loadAll();
  }

  async function rejectRequest(req: ChangeRequest) {
    setActionLoading(req.id);
    await supabase.from("profile_change_requests").update({ status: "rejected", admin_note: rejectNote.trim() || null, reviewed_at: new Date().toISOString() }).eq("id", req.id);
    toast("Request rejected.", "success");
    void logAudit({ action: "reject_change_request", entity_type: "user", entity_id: req.user_id, details: { field: req.field_name, requested: req.new_value, note: rejectNote.trim() || null } });
    setRejectingId(null);
    setRejectNote("");
    setActionLoading(null);
    void loadAll();
  }

  function extractNames(items: any[], key: string): string[] {
    return items.flatMap((item) => {
      const val = item?.[key];
      if (Array.isArray(val)) return val.map((x: any) => x?.name).filter(Boolean);
      if (val?.name) return [val.name];
      return [];
    });
  }

  function extractIds(items: any[], key: string): string[] {
    return items.flatMap((item) => {
      const val = item?.[key];
      if (Array.isArray(val)) return val.map((x: any) => x?.id).filter(Boolean);
      if (val?.id) return [val.id];
      return [];
    });
  }

  function startEdit(m: Member) {
    setEditingId(m.id);
    setEditState({
      full_name: m.full_name ?? "",
      call_sign: m.call_sign ?? "",
      phone: m.phone ?? "",
      home_address: m.home_address ?? "",
      car_make: m.car_make ?? "",
      car_model: m.car_model ?? "",
      car_color: m.car_color ?? "",
      license_plate_state: m.license_plate_state ?? "",
      license_plate_number: m.license_plate_number ?? "",
      is_active: m.is_active !== false,
      is_on_duty: m.is_on_duty !== false,
      roles: m.roles,
      units: m.units,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditState(null);
  }

  async function saveEdit(m: Member) {
    if (!editState) return;
    setSaving(true);

    const { error } = await supabase.from("users").update({
      full_name: editState.full_name.trim() || null,
      call_sign: editState.call_sign.trim() || null,
      phone: editState.phone.trim() || null,
      home_address: editState.home_address.trim() || null,
      car_make: editState.car_make.trim() || null,
      car_model: editState.car_model.trim() || null,
      car_color: editState.car_color.trim() || null,
      license_plate_state: editState.license_plate_state.trim() || null,
      license_plate_number: editState.license_plate_number.trim() || null,
      is_active: editState.is_active,
      is_on_duty: editState.is_on_duty,
    }).eq("id", m.id);

    if (error) { toast(error.message, "error"); setSaving(false); return; }

    // Sync roles
    await supabase.from("user_roles").delete().eq("user_id", m.id);
    const roleIds = allRoles.filter((r) => editState.roles.includes(r.name)).map((r) => r.id);
    if (roleIds.length) await supabase.from("user_roles").insert(roleIds.map((id) => ({ user_id: m.id, role_id: id })));

    // Sync units
    await supabase.from("user_units").delete().eq("user_id", m.id);
    const unitIds = allUnits.filter((u) => editState.units.includes(u.name)).map((u) => u.id);
    if (unitIds.length) await supabase.from("user_units").insert(unitIds.map((id) => ({ user_id: m.id, unit_id: id })));

    setSaving(false);
    setEditingId(null);
    setEditState(null);
    toast("Saved.", "success");
    void logAudit({
      action: "edit_member",
      entity_type: "user",
      entity_id: m.id,
      entity_label: editState.full_name || m.email,
      details: { roles: editState.roles, units: editState.units, is_active: editState.is_active },
    });
    // Notify the member their profile was updated
    void fetch("/api/send-push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: m.id, title: "Profile Updated", body: "An admin has updated your profile.", url: "/settings" }),
    });
    await loadAll();
  }

  async function inviteNew() {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), full_name: inviteName.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { toast(data.error || "Failed to send invite.", "error"); }
      else { toast(`Invite sent to ${inviteEmail.trim()}.`, "success"); setInviteEmail(""); setInviteName(""); void loadAll(); }
    } catch { toast("Failed to send invite.", "error"); }
    setInviting(false);
  }

  async function sendInvite(m: Member) {
    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: m.email, full_name: m.full_name }),
      });
      const data = await res.json();
      if (!res.ok) { toast(data.error || "Failed.", "error"); return; }
      toast(`Invite sent to ${m.email}.`, "success");
    } catch {
      toast("Failed to send invite.", "error");
    }
  }

  function enterBulkEdit() {
    const initial: Record<string, EditState> = {};
    members.forEach((m) => {
      initial[m.id] = {
        full_name: m.full_name ?? "",
        call_sign: m.call_sign ?? "",
        phone: m.phone ?? "",
        is_active: m.is_active !== false,
        is_on_duty: m.is_on_duty !== false,
        roles: [...m.roles],
        units: [...m.units],
      };
    });
    setBulkEdits(initial);
    setTab("bulk");
  }

  function bulkSet(id: string, patch: Partial<EditState>) {
    setBulkEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  function bulkToggleRole(id: string, name: string) {
    const current = bulkEdits[id];
    if (!current) return;
    const has = current.roles.includes(name);
    bulkSet(id, { roles: has ? current.roles.filter((r) => r !== name) : [...current.roles, name] });
  }

  function bulkToggleUnit(id: string, name: string) {
    const current = bulkEdits[id];
    if (!current) return;
    const has = current.units.includes(name);
    bulkSet(id, { units: has ? current.units.filter((u) => u !== name) : [...current.units, name] });
  }

  function isBulkDirty(m: Member): boolean {
    const e = bulkEdits[m.id];
    if (!e) return false;
    return e.full_name !== (m.full_name ?? "") ||
      e.call_sign !== (m.call_sign ?? "") ||
      e.phone !== (m.phone ?? "") ||
      e.is_active !== (m.is_active !== false) ||
      e.is_on_duty !== (m.is_on_duty !== false) ||
      JSON.stringify([...e.roles].sort()) !== JSON.stringify([...m.roles].sort()) ||
      JSON.stringify([...e.units].sort()) !== JSON.stringify([...m.units].sort());
  }

  async function saveBulkEdits() {
    const dirty = members.filter(isBulkDirty);
    if (!dirty.length) { toast("No changes to save.", "error"); return; }
    setBulkSaving(true);
    for (const m of dirty) {
      const e = bulkEdits[m.id];
      if (!e) continue;
      const { error } = await supabase.from("users").update({
        full_name: e.full_name.trim() || null,
        call_sign: e.call_sign.trim() || null,
        phone: e.phone.trim() || null,
        is_active: e.is_active,
        is_on_duty: e.is_on_duty,
      }).eq("id", m.id);
      if (error) { toast(`Error saving ${m.full_name ?? m.email}: ${error.message}`, "error"); continue; }
      await supabase.from("user_roles").delete().eq("user_id", m.id);
      const roleIds = allRoles.filter((r) => e.roles.includes(r.name)).map((r) => r.id);
      if (roleIds.length) await supabase.from("user_roles").insert(roleIds.map((id) => ({ user_id: m.id, role_id: id })));
      await supabase.from("user_units").delete().eq("user_id", m.id);
      const unitIds = allUnits.filter((u) => e.units.includes(u.name)).map((u) => u.id);
      if (unitIds.length) await supabase.from("user_units").insert(unitIds.map((id) => ({ user_id: m.id, unit_id: id })));
    }
    setBulkSaving(false);
    toast(`Saved ${dirty.length} member${dirty.length !== 1 ? "s" : ""}.`, "success");
    void logAudit({ action: "bulk_edit_roster", entity_type: "roster", entity_id: "bulk", details: { count: dirty.length } });
    await loadAll();
    enterBulkEdit();
  }

  function exportCsv() {
    const cols = ["Name", "Call Sign", "Email", "Phone", "Roles", "Units", "Active", "On Duty", "Invited", "Joined"];
    const rows = filtered.map((m) => [
      m.full_name ?? "",
      m.call_sign ?? "",
      m.email,
      m.phone ?? "",
      m.roles.join("; "),
      m.units.join("; "),
      m.is_active !== false ? "Yes" : "No",
      m.is_on_duty !== false ? "Yes" : "No",
      m.is_invited ? "Yes" : "No",
      new Date(m.created_at).toLocaleDateString(),
    ]);
    const csv = [cols, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `roster-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  const filtered = useMemo(() => {
    let list = members;
    if (filterActive === "active") list = list.filter((m) => m.is_active !== false);
    if (filterActive === "inactive") list = list.filter((m) => m.is_active === false);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((m) =>
        (m.full_name ?? "").toLowerCase().includes(q) ||
        (m.call_sign ?? "").toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.roles.join(" ").toLowerCase().includes(q) ||
        m.units.join(" ").toLowerCase().includes(q)
      );
    }
    return list;
  }, [members, search, filterActive]);

  function toggleRole(name: string) {
    if (!editState) return;
    const has = editState.roles.includes(name);
    setEditState({ ...editState, roles: has ? editState.roles.filter((r) => r !== name) : [...editState.roles, name] });
  }

  function toggleUnit(name: string) {
    if (!editState) return;
    const has = editState.units.includes(name);
    setEditState({ ...editState, units: has ? editState.units.filter((u) => u !== name) : [...editState.units, name] });
  }

  return (
    <main className="p-6 lg:p-8">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-zinc-50">Roster</h1>
          <div className="flex flex-wrap gap-2">
            <button onClick={exportCsv} className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 transition">
              Export CSV
            </button>
          </div>
        </div>

        {/* Invite new member */}
        <div className="rounded-xl bg-zinc-900 p-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1 flex-1 min-w-36">
            <label className="text-xs text-zinc-500">Email *</label>
            <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void inviteNew()}
              placeholder="member@example.com"
              type="email"
              className="w-full rounded-lg bg-black px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-red-600 placeholder-zinc-600" />
          </div>
          <div className="space-y-1 flex-1 min-w-36">
            <label className="text-xs text-zinc-500">Name (optional)</label>
            <input value={inviteName} onChange={(e) => setInviteName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void inviteNew()}
              placeholder="Full name"
              className="w-full rounded-lg bg-black px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-red-600 placeholder-zinc-600" />
          </div>
          <button onClick={() => void inviteNew()} disabled={inviting || !inviteEmail.trim()}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition shrink-0">
            {inviting ? "Sending…" : "Send Invite"}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-zinc-800 pb-0">
          {(["roster", "requests", "bulk"] as const).map((t) => (
            <button key={t}
              onClick={() => t === "bulk" ? enterBulkEdit() : setTab(t)}
              className={`relative px-4 py-2 text-sm font-medium transition ${tab === t ? "text-zinc-50 border-b-2 border-red-500 -mb-px" : "text-zinc-500 hover:text-zinc-300"}`}>
              {t === "requests" ? "Change Requests" : t === "bulk" ? "Bulk Edit" : "Members"}
              {t === "requests" && changeRequests.length > 0 && (
                <span className="ml-1.5 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{changeRequests.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Change Requests panel */}
        {tab === "requests" && (
          <div className="space-y-3">
            {changeRequests.length === 0 ? (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-6 py-12 text-center text-zinc-600">
                No pending change requests.
              </div>
            ) : changeRequests.map((req) => {
              const user = req.users;
              const memberLabel = user?.call_sign ?? user?.full_name ?? user?.email ?? "Unknown";
              const fieldLabel = req.field_name === "full_name" ? "Full Name" : req.field_name === "call_sign" ? "Call Sign" : req.field_name;
              return (
                <div key={req.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-zinc-100">{memberLabel}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">{user?.email} · {new Date(req.created_at).toLocaleDateString()}</div>
                    </div>
                    <span className="shrink-0 rounded-md bg-yellow-900/40 px-2 py-0.5 text-xs text-yellow-400">pending</span>
                  </div>
                  <div className="rounded-lg bg-zinc-950 px-4 py-3 text-sm space-y-1">
                    <div className="text-xs text-zinc-500 uppercase tracking-wide">{fieldLabel}</div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-zinc-500 line-through">{req.old_value || "—"}</span>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 text-zinc-600 shrink-0"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                      <span className="text-zinc-100 font-medium">{req.new_value}</span>
                    </div>
                  </div>
                  {rejectingId === req.id ? (
                    <div className="space-y-2">
                      <input
                        autoFocus
                        value={rejectNote}
                        onChange={(e) => setRejectNote(e.target.value)}
                        placeholder="Reason for rejection (optional)"
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-500"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => void rejectRequest(req)} disabled={actionLoading === req.id}
                          className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-60 transition">
                          {actionLoading === req.id ? "…" : "Confirm Reject"}
                        </button>
                        <button onClick={() => { setRejectingId(null); setRejectNote(""); }}
                          className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 transition">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => void approveRequest(req)} disabled={actionLoading === req.id}
                        className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600 disabled:opacity-60 transition">
                        {actionLoading === req.id ? "…" : "Approve"}
                      </button>
                      <button onClick={() => setRejectingId(req.id)}
                        className="rounded-lg border border-red-900 bg-red-950/30 px-4 py-2 text-sm text-red-400 hover:bg-red-950/60 transition">
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Bulk Edit panel */}
        {tab === "bulk" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-zinc-500">Edit all rows inline. Changed rows are highlighted. Click Save All when done.</p>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => setTab("roster")} className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 transition">
                  Cancel
                </button>
                <button onClick={() => void saveBulkEdits()} disabled={bulkSaving}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 transition">
                  {bulkSaving ? "Saving…" : `Save All (${members.filter(isBulkDirty).length} changed)`}
                </button>
              </div>
            </div>
            <div className="overflow-x-auto rounded-xl border border-zinc-800">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    <th className="px-3 py-2.5">Name</th>
                    <th className="px-3 py-2.5">Call Sign</th>
                    <th className="px-3 py-2.5">Phone</th>
                    <th className="px-3 py-2.5">Roles</th>
                    <th className="px-3 py-2.5">Units</th>
                    <th className="px-3 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {members.map((m) => {
                    const e = bulkEdits[m.id];
                    if (!e) return null;
                    const dirty = isBulkDirty(m);
                    return (
                      <tr key={m.id} className={dirty ? "bg-amber-950/20" : "hover:bg-zinc-800/20"}>
                        <td className="px-2 py-1.5">
                          <input value={e.full_name}
                            onChange={(ev) => bulkSet(m.id, { full_name: ev.target.value })}
                            className="w-36 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-zinc-100 outline-none focus:border-red-600"
                            placeholder="Full name" />
                        </td>
                        <td className="px-2 py-1.5">
                          <input value={e.call_sign}
                            onChange={(ev) => bulkSet(m.id, { call_sign: ev.target.value })}
                            className="w-24 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm font-mono text-zinc-100 outline-none focus:border-red-600"
                            placeholder="Call sign" />
                        </td>
                        <td className="px-2 py-1.5">
                          <input value={e.phone}
                            onChange={(ev) => bulkSet(m.id, { phone: ev.target.value })}
                            className="w-32 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-zinc-100 outline-none focus:border-red-600"
                            placeholder="Phone" />
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="flex flex-wrap gap-1">
                            {allRoles.map((r) => (
                              <button key={r.id} onClick={() => bulkToggleRole(m.id, r.name)}
                                className={`rounded px-1.5 py-0.5 text-xs transition ${e.roles.includes(r.name) ? "bg-red-600 text-white" : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"}`}>
                                {r.name}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="flex flex-wrap gap-1">
                            {allUnits.map((u) => (
                              <button key={u.id} onClick={() => bulkToggleUnit(m.id, u.name)}
                                className={`rounded px-1.5 py-0.5 text-xs transition ${e.units.includes(u.name) ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"}`}>
                                {u.name}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="flex flex-col gap-1">
                            <button onClick={() => bulkSet(m.id, { is_active: !e.is_active })}
                              className={`rounded px-2 py-0.5 text-xs transition ${e.is_active ? "bg-green-700 text-green-100" : "bg-zinc-700 text-zinc-500"}`}>
                              {e.is_active ? "Active" : "Inactive"}
                            </button>
                            <button onClick={() => bulkSet(m.id, { is_on_duty: !e.is_on_duty })}
                              className={`rounded px-2 py-0.5 text-xs transition ${e.is_on_duty ? "bg-blue-700 text-blue-100" : "bg-zinc-700 text-zinc-500"}`}>
                              {e.is_on_duty ? "On Duty" : "Off Duty"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "roster" && <>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {(["active", "inactive", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilterActive(f)}
              className={`rounded-lg px-3 py-1.5 text-sm capitalize transition ${filterActive === f ? "bg-red-600 text-white" : "border border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}
            >
              {f}
            </button>
          ))}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, call sign, email…"
            className="ml-auto rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none w-64 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
          />
          <span className="text-sm text-zinc-500">{filtered.length} member{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Table */}
        {loading ? (
          <div className="animate-pulse space-y-2">
            {[...Array(6)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-zinc-800" />)}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Call Sign</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Roles</th>
                  <th className="px-4 py-3">Units</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filtered.map((m) =>
                  editingId === m.id && editState ? (<>
                    <tr key={m.id} className="bg-zinc-800/60">
                      <td className="px-3 py-2">
                        <input value={editState.full_name} onChange={(e) => setEditState({ ...editState, full_name: e.target.value })}
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 outline-none" />
                      </td>
                      <td className="px-3 py-2">
                        <input value={editState.call_sign} onChange={(e) => setEditState({ ...editState, call_sign: e.target.value })}
                          className="w-28 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 outline-none" />
                      </td>
                      <td className="px-3 py-2 text-zinc-400">{m.email}</td>
                      <td className="px-3 py-2">
                        <input value={editState.phone} onChange={(e) => setEditState({ ...editState, phone: e.target.value })}
                          className="w-32 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 outline-none" />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {allRoles.map((r) => (
                            <button key={r.id} onClick={() => toggleRole(r.name)}
                              className={`rounded-md px-2 py-0.5 text-xs transition ${editState.roles.includes(r.name) ? "bg-red-600 text-white" : "bg-zinc-700 text-zinc-400 hover:bg-zinc-600"}`}>
                              {r.name}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {allUnits.map((u) => (
                            <button key={u.id} onClick={() => toggleUnit(u.name)}
                              className={`rounded-md px-2 py-0.5 text-xs transition ${editState.units.includes(u.name) ? "bg-blue-600 text-white" : "bg-zinc-700 text-zinc-400 hover:bg-zinc-600"}`}>
                              {u.name}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-1">
                          <button onClick={() => setEditState({ ...editState, is_active: !editState.is_active })}
                            className={`rounded-md px-2 py-0.5 text-xs transition ${editState.is_active ? "bg-green-700 text-green-100" : "bg-zinc-700 text-zinc-400"}`}>
                            {editState.is_active ? "Active" : "Inactive"}
                          </button>
                          <button onClick={() => setEditState({ ...editState, is_on_duty: !editState.is_on_duty })}
                            className={`rounded-md px-2 py-0.5 text-xs transition ${editState.is_on_duty ? "bg-blue-700 text-blue-100" : "bg-zinc-700 text-zinc-400"}`}>
                            {editState.is_on_duty ? "On Duty" : "Off Duty"}
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <button onClick={() => void saveEdit(m)} disabled={saving}
                            className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60 hover:bg-green-500">
                            {saving ? "…" : "Save"}
                          </button>
                          <button onClick={cancelEdit} className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700">Cancel</button>
                        </div>
                      </td>
                    </tr>
                    {/* Extra personal info fields */}
                    <tr key={`${m.id}-extra`} className="bg-zinc-800/40 border-b border-zinc-800">
                      <td colSpan={8} className="px-4 py-3">
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                          <div className="lg:col-span-2">
                            <label className="mb-1 block text-xs text-zinc-500">Home Address</label>
                            <input value={editState.home_address} onChange={(e) => setEditState({ ...editState, home_address: e.target.value })}
                              placeholder="123 Main St…"
                              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100 outline-none" />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-zinc-500">Car Make</label>
                            <input value={editState.car_make} onChange={(e) => setEditState({ ...editState, car_make: e.target.value })}
                              placeholder="Toyota"
                              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100 outline-none" />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-zinc-500">Car Model</label>
                            <input value={editState.car_model} onChange={(e) => setEditState({ ...editState, car_model: e.target.value })}
                              placeholder="Tacoma"
                              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100 outline-none" />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-zinc-500">Car Color</label>
                            <input value={editState.car_color} onChange={(e) => setEditState({ ...editState, car_color: e.target.value })}
                              placeholder="Silver"
                              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100 outline-none" />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-zinc-500">Plate State</label>
                            <input value={editState.license_plate_state} onChange={(e) => setEditState({ ...editState, license_plate_state: e.target.value })}
                              placeholder="NY"
                              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100 outline-none" />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-zinc-500">Plate Number</label>
                            <input value={editState.license_plate_number} onChange={(e) => setEditState({ ...editState, license_plate_number: e.target.value })}
                              placeholder="ABC1234"
                              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100 outline-none" />
                          </div>
                        </div>
                      </td>
                    </tr>
                  </>) : (
                    <tr key={m.id} className="hover:bg-zinc-800/40 transition">
                      <td className="px-4 py-3 font-medium text-zinc-100">{m.full_name ?? <span className="text-zinc-600">—</span>}</td>
                      <td className="px-4 py-3 font-mono text-zinc-300">{m.call_sign ?? <span className="text-zinc-600">—</span>}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-400 text-sm">{m.email}</span>
                          <a href={`mailto:${m.email}`} title="Email" className="text-zinc-600 hover:text-blue-400 transition shrink-0">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                          </a>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {m.phone ? (
                          <div className="flex items-center gap-2">
                            <span className="text-zinc-400 text-sm">{m.phone}</span>
                            <a href={`tel:${m.phone}`} title="Call" className="text-zinc-600 hover:text-green-400 transition shrink-0">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.24h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.22 6.22l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                            </a>
                            <a href={`sms:${m.phone}`} title="Text" className="text-zinc-600 hover:text-yellow-400 transition shrink-0">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                            </a>
                            <a href={`https://wa.me/${m.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" title="WhatsApp" className="text-zinc-600 hover:text-green-500 transition shrink-0">
                              <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
                            </a>
                          </div>
                        ) : <span className="text-zinc-600">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {m.roles.length ? m.roles.map((r) => (
                            <span key={r} className="rounded-md bg-red-950/60 px-2 py-0.5 text-xs text-red-300">{r}</span>
                          )) : <span className="text-zinc-600">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {m.units.length ? m.units.map((u) => (
                            <span key={u} className="rounded-md bg-blue-950/60 px-2 py-0.5 text-xs text-blue-300">{u}</span>
                          )) : <span className="text-zinc-600">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className={`text-xs font-medium ${m.is_active !== false ? "text-green-400" : "text-zinc-600"}`}>
                            {m.is_active !== false ? "Active" : "Inactive"}
                          </span>
                          <span className={`text-xs ${m.is_on_duty !== false ? "text-blue-400" : "text-zinc-600"}`}>
                            {m.is_on_duty !== false ? "On Duty" : "Off Duty"}
                          </span>
                          {m.is_invited && <span className="text-xs text-yellow-500">Invited</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => startEdit(m)}
                            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 transition">
                            Edit
                          </button>
                          <button onClick={() => void sendInvite(m)}
                            className="rounded-lg border border-blue-800 bg-blue-950/40 px-3 py-1.5 text-xs text-blue-300 hover:bg-blue-950 transition">
                            Invite
                          </button>
                          <button onClick={() => setCertsForMember(m)}
                            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 transition">
                            Certs
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                )}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-zinc-600">No members found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        </>}
      </div>
      {certsForMember && (
        <CertsModal member={certsForMember} onClose={() => setCertsForMember(null)} toast={toast} />
      )}
    </main>
  );
}

function CertsModal({ member, onClose, toast }: { member: { id: string; full_name: string | null; call_sign: string | null }; onClose: () => void; toast: (msg: string, type: "success" | "error") => void }) {
  const [certs, setCerts] = useState<Certification[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newExpiry, setNewExpiry] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("certifications").select("id,name,expires_at").eq("user_id", member.id).order("expires_at", { ascending: true });
    setCerts((data as Certification[]) ?? []);
    setLoading(false);
  }

  async function addCert() {
    if (!newName.trim()) { toast("Enter a certification name.", "error"); return; }
    setAdding(true);
    const { error } = await supabase.from("certifications").insert({ user_id: member.id, name: newName.trim(), expires_at: newExpiry || null });
    setAdding(false);
    if (error) { toast(error.message, "error"); return; }
    setNewName("");
    setNewExpiry("");
    toast("Certification added.", "success");
    await load();
  }

  async function deleteCert(id: string) {
    const { error } = await supabase.from("certifications").delete().eq("id", id);
    if (error) { toast(error.message, "error"); return; }
    toast("Removed.", "success");
    await load();
  }

  const label = member.call_sign ?? member.full_name ?? "Member";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 space-y-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-bold text-zinc-50">{label}</div>
            <div className="text-xs text-zinc-500">Certifications</div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 text-2xl leading-none px-1">×</button>
        </div>

        {loading ? (
          <div className="py-8 flex justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-red-500" /></div>
        ) : certs.length === 0 ? (
          <p className="text-sm text-zinc-600 italic">No certifications on file.</p>
        ) : (
          <div className="space-y-2">
            {certs.map((c) => {
              const expired = c.expires_at && new Date(c.expires_at) < new Date();
              const expiringSoon = c.expires_at && !expired && (new Date(c.expires_at).getTime() - Date.now()) < 30 * 24 * 60 * 60 * 1000;
              return (
                <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3">
                  <div>
                    <div className="font-medium text-zinc-100">{c.name}</div>
                    <div className={`text-xs mt-0.5 ${expired ? "text-red-400" : expiringSoon ? "text-yellow-400" : "text-zinc-500"}`}>
                      {c.expires_at ? `Expires ${new Date(c.expires_at).toLocaleDateString()}${expired ? " — EXPIRED" : expiringSoon ? " — Expiring soon" : ""}` : "No expiration"}
                    </div>
                  </div>
                  <button onClick={() => void deleteCert(c.id)} className="shrink-0 rounded-lg border border-red-900 bg-red-950/40 px-2.5 py-1 text-xs text-red-400 hover:bg-red-950 transition">
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="space-y-2 border-t border-zinc-800 pt-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Add Certification</div>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Certification name"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-500" />
          <input type="date" value={newExpiry} onChange={(e) => setNewExpiry(e.target.value)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-500" />
          <button onClick={() => void addCert()} disabled={adding}
            className="w-full rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60 transition">
            {adding ? "Adding…" : "Add Certification"}
          </button>
        </div>
      </div>
    </div>
  );
}
