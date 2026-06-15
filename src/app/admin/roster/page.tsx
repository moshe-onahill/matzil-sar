"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";

type Role = { id: string; name: string };
type Unit = { id: string; name: string };

type Member = {
  id: string;
  email: string;
  full_name: string | null;
  call_sign: string | null;
  phone: string | null;
  is_active: boolean | null;
  is_on_duty: boolean | null;
  is_invited: boolean | null;
  created_at: string;
  roles: string[];
  units: string[];
};

type EditState = {
  full_name: string;
  call_sign: string;
  phone: string;
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

  useEffect(() => { void loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [usersRes, rolesRes, unitsRes] = await Promise.all([
      supabase.from("users").select(`
        id, email, full_name, call_sign, phone, is_active, is_on_duty, is_invited, created_at,
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
    setLoading(false);
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
    await loadAll();
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
            <Link href="/roster/new" className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 transition">
              + Add Member
            </Link>
          </div>
        </div>

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
                  editingId === m.id && editState ? (
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
                  ) : (
                    <tr key={m.id} className="hover:bg-zinc-800/40 transition">
                      <td className="px-4 py-3 font-medium text-zinc-100">{m.full_name ?? <span className="text-zinc-600">—</span>}</td>
                      <td className="px-4 py-3 font-mono text-zinc-300">{m.call_sign ?? <span className="text-zinc-600">—</span>}</td>
                      <td className="px-4 py-3 text-zinc-400">{m.email}</td>
                      <td className="px-4 py-3 text-zinc-400">{m.phone ?? <span className="text-zinc-600">—</span>}</td>
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
      </div>
    </main>
  );
}
