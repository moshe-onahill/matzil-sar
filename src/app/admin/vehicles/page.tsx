"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import { logAudit } from "@/lib/audit";

type Vehicle = {
  id: string;
  name: string;
  vehicle_type: string | null;
  lat: number | null;
  lng: number | null;
  is_active: boolean | null;
  updated_at: string | null;
};

const VEHICLE_TYPES = ["SUV", "Truck", "Van", "ATV", "Boat", "Helicopter", "Other"];

export default function AdminVehiclesPage() {
  const toast = useToast();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("");
  const [editLat, setEditLat] = useState("");
  const [editLng, setEditLng] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => { void load(); }, []);

  async function load() {
    const { data } = await supabase
      .from("agency_vehicles")
      .select("id,name,vehicle_type,lat,lng,is_active,updated_at")
      .order("name");
    setVehicles((data ?? []) as Vehicle[]);
    setLoading(false);
  }

  function startEdit(v: Vehicle) {
    setEditingId(v.id);
    setEditName(v.name);
    setEditType(v.vehicle_type ?? "");
    setEditLat(v.lat != null ? String(v.lat) : "");
    setEditLng(v.lng != null ? String(v.lng) : "");
    setEditActive(v.is_active !== false);
  }

  async function saveEdit() {
    if (!editingId || !editName.trim()) return;
    setSaving(true);
    const lat = editLat ? parseFloat(editLat) : null;
    const lng = editLng ? parseFloat(editLng) : null;
    const { error } = await supabase.from("agency_vehicles").update({
      name: editName.trim(),
      vehicle_type: editType || null,
      lat: lat && !isNaN(lat) ? lat : null,
      lng: lng && !isNaN(lng) ? lng : null,
      is_active: editActive,
      updated_at: new Date().toISOString(),
    }).eq("id", editingId);
    if (error) { toast(error.message, "error"); }
    else {
      toast("Saved.", "success");
      void logAudit({ action: "edit_vehicle", entity_type: "vehicle", entity_id: editingId, entity_label: editName.trim() });
      setEditingId(null);
      void load();
    }
    setSaving(false);
  }

  async function createVehicle() {
    if (!newName.trim()) return;
    setCreating(true);
    const { error } = await supabase.from("agency_vehicles").insert({
      name: newName.trim(),
      vehicle_type: newType || null,
      is_active: true,
    });
    if (error) { toast(error.message, "error"); }
    else {
      toast("Vehicle added.", "success");
      void logAudit({ action: "create_vehicle", entity_type: "vehicle", entity_label: newName.trim() });
      setNewName("");
      setNewType("");
      void load();
    }
    setCreating(false);
  }

  async function toggleActive(v: Vehicle) {
    await supabase.from("agency_vehicles").update({ is_active: !v.is_active }).eq("id", v.id);
    void load();
  }

  async function deleteVehicle(v: Vehicle) {
    if (!window.confirm(`Delete "${v.name}"?`)) return;
    await supabase.from("agency_vehicles").delete().eq("id", v.id);
    void logAudit({ action: "delete_vehicle", entity_type: "vehicle", entity_id: v.id, entity_label: v.name });
    void load();
  }

  return (
    <main className="p-6 lg:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-2xl font-bold text-zinc-50">Vehicles</h1>

        {/* Add new */}
        <div className="rounded-xl bg-zinc-900 p-5 space-y-3">
          <div className="font-semibold text-zinc-100">Add Vehicle</div>
          <div className="flex flex-wrap gap-3">
            <input value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void createVehicle()}
              placeholder="Vehicle name / callsign"
              className="flex-1 min-w-40 rounded-lg bg-black px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-red-600 placeholder-zinc-600" />
            <select value={newType} onChange={(e) => setNewType(e.target.value)}
              className="rounded-lg bg-black px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-red-600">
              <option value="">Type…</option>
              {VEHICLE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <button onClick={() => void createVehicle()} disabled={creating || !newName.trim()}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition">
              {creating ? "Adding…" : "Add"}
            </button>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-zinc-900 animate-pulse" />)}</div>
        ) : vehicles.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-6 py-12 text-center text-zinc-600">No vehicles yet.</div>
        ) : (
          <div className="space-y-2">
            {vehicles.map((v) => editingId === v.id ? (
              <div key={v.id} className="rounded-xl bg-zinc-900 p-4 space-y-3">
                <div className="flex flex-wrap gap-3">
                  <input value={editName} onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 min-w-40 rounded-lg bg-black px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-red-600" />
                  <select value={editType} onChange={(e) => setEditType(e.target.value)}
                    className="rounded-lg bg-black px-3 py-2 text-sm text-zinc-100 outline-none">
                    <option value="">No type</option>
                    {VEHICLE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="flex gap-3">
                  <input value={editLat} onChange={(e) => setEditLat(e.target.value)}
                    placeholder="Lat" type="number" step="any"
                    className="flex-1 rounded-lg bg-black px-3 py-2 text-sm text-zinc-100 outline-none" />
                  <input value={editLng} onChange={(e) => setEditLng(e.target.value)}
                    placeholder="Lng" type="number" step="any"
                    className="flex-1 rounded-lg bg-black px-3 py-2 text-sm text-zinc-100 outline-none" />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} className="accent-red-600" />
                  <span className="text-sm text-zinc-300">Active (show on map)</span>
                </label>
                <div className="flex gap-2">
                  <button onClick={() => void saveEdit()} disabled={saving}
                    className="rounded-lg bg-green-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
                    {saving ? "…" : "Save"}
                  </button>
                  <button onClick={() => setEditingId(null)} className="rounded-lg bg-zinc-700 px-4 py-1.5 text-sm text-zinc-300">Cancel</button>
                </div>
              </div>
            ) : (
              <div key={v.id} className="rounded-xl bg-zinc-900 px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-zinc-100">{v.name}</span>
                    {v.vehicle_type && <span className="text-xs text-zinc-500 bg-zinc-800 rounded px-1.5 py-0.5">{v.vehicle_type}</span>}
                    <span className={`text-xs rounded px-1.5 py-0.5 ${v.is_active !== false ? "bg-green-900/50 text-green-400" : "bg-zinc-800 text-zinc-500"}`}>
                      {v.is_active !== false ? "Active" : "Inactive"}
                    </span>
                  </div>
                  {v.lat != null && v.lng != null && (
                    <a href={`https://maps.google.com/?q=${v.lat},${v.lng}`} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:underline">
                      {v.lat.toFixed(4)}, {v.lng.toFixed(4)}
                    </a>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => startEdit(v)} className="rounded-lg bg-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-600 transition">Edit</button>
                  <button onClick={() => void toggleActive(v)} className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-700 transition">
                    {v.is_active !== false ? "Deactivate" : "Activate"}
                  </button>
                  <button onClick={() => void deleteVehicle(v)} className="rounded-lg bg-red-950/40 px-3 py-1.5 text-xs text-red-400 hover:bg-red-950 transition">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
