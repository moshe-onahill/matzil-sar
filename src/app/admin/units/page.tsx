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
  users?: { full_name: string | null; call_sign: string | null };
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

type UnitRow = {
  user_id: string;
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

export default function AdminUnitsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<UnitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "responding" | "on_location">("all");
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
        .select(`
          id, user_id, incident_id, response_type, eta_minutes, responded_at,
          users ( full_name, call_sign, phone ),
          incidents ( title, incident_number, status )
        `)
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
    setLoading(false);
  }

  function exportCsv() {
    const cols = ["Name", "Call Sign", "Phone", "Incident #", "Incident", "Status", "ETA (min)", "Has GPS", "Lat", "Lng", "GPS Age (min)", "Responded At"];
    const data = filtered.map((r) => [
      r.full_name, r.call_sign, r.phone,
      r.incident_number, r.incident_title, r.response_type,
      r.eta_minutes ?? "",
      r.has_location ? "Yes" : "No",
      r.lat ?? "", r.lng ?? "",
      r.location_age_min ?? "",
      new Date(r.responded_at).toLocaleString(),
    ]);
    const csv = [cols, ...data].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `responding-units-${new Date().toISOString().slice(0, 16).replace("T", "-")}.csv`;
    a.click();
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
            <button onClick={() => void loadData()} className="rounded-lg bg-gray-800 px-4 py-2 text-sm hover:bg-gray-700">
              Refresh
            </button>
            <button onClick={exportCsv} className="rounded-lg bg-gray-800 px-4 py-2 text-sm hover:bg-gray-700">
              Export CSV
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {([["all", "All"], ["responding", "Responding"], ["on_location", "On Location"]] as const).map(([f, label]) => (
            <button
              key={f}
              onClick={() => setFilterStatus(f)}
              className={`rounded-lg px-3 py-1.5 text-sm ${filterStatus === f ? "bg-red-600 text-white" : "bg-gray-800 text-gray-400"}`}
            >
              {label}
            </button>
          ))}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, call sign, incident…"
            className="ml-auto rounded-lg bg-gray-900 px-3 py-1.5 text-sm w-56 outline-none focus:ring-1 focus:ring-red-600"
          />
        </div>

        <div className="text-sm text-gray-500">{filtered.length} unit{filtered.length !== 1 ? "s" : ""}</div>

        {loading ? (
          <div className="animate-pulse space-y-2">
            {[...Array(4)].map((_, i) => <div key={i} className="h-12 rounded bg-gray-900" />)}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Call Sign</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Incident</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">ETA</th>
                  <th className="px-4 py-3">GPS</th>
                  <th className="px-4 py-3">Responded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {filtered.map((r, i) => (
                  <tr key={`${r.user_id}-${i}`} className="hover:bg-gray-900/60 transition">
                    <td className="px-4 py-3 font-medium">{r.full_name}</td>
                    <td className="px-4 py-3 font-mono text-gray-300">{r.call_sign}</td>
                    <td className="px-4 py-3 text-gray-400">{r.phone}</td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs text-gray-500">{r.incident_number}</div>
                      <div className="text-gray-200">{r.incident_title}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                        r.response_type === "On Location" ? "bg-green-900/60 text-green-300" : "bg-blue-900/60 text-blue-300"
                      }`}>
                        {r.response_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {r.eta_minutes != null ? `${r.eta_minutes} min` : <span className="text-gray-600">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {r.has_location ? (
                        <div>
                          <div className="flex items-center gap-1 text-green-400">
                            <span className="h-2 w-2 rounded-full bg-green-400 inline-block" />
                            Live
                          </div>
                          <div className="text-xs text-gray-500">
                            {r.location_age_min != null ? `${r.location_age_min}m ago` : ""}
                          </div>
                          {r.lat && r.lng && (
                            <a
                              href={`https://maps.google.com/?q=${r.lat},${r.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-400 hover:underline"
                            >
                              {r.lat.toFixed(4)}, {r.lng.toFixed(4)}
                            </a>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-600">No GPS</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(r.responded_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-gray-600">No active responding units.</td>
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
