"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Incident = {
  id: string;
  title: string;
  incident_number: string;
  type: string;
  status: string;
  created_at: string;
  staging_address: string | null;
};

export default function AdminIncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"Active" | "All">("Active");

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    let q = supabase.from("incidents").select("id,title,incident_number,type,status,created_at,staging_address").order("created_at", { ascending: false });
    if (filter === "Active") q = q.eq("status", "Active");
    const { data } = await q;
    setIncidents((data as Incident[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [filter]);

  return (
    <main className="p-6 lg:p-8">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            
            <h1 className="text-2xl font-bold text-zinc-50">Incident Coordination</h1>
          </div>
          <div className="flex gap-2">
            {(["Active", "All"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`rounded-lg px-3 py-1.5 text-sm ${filter === f ? "bg-red-600" : "bg-gray-800 text-gray-400"}`}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="animate-pulse space-y-2">
            {[...Array(3)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-gray-900" />)}
          </div>
        ) : incidents.length === 0 ? (
          <div className="rounded-xl bg-gray-900 p-8 text-center text-gray-500">No {filter === "Active" ? "active " : ""}incidents.</div>
        ) : (
          <div className="space-y-2">
            {incidents.map((inc) => (
              <Link key={inc.id} href={`/admin/incidents/${inc.id}`}
                className="flex items-center justify-between gap-4 rounded-xl bg-gray-900 p-4 hover:bg-gray-800 transition">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${inc.status === "Active" ? "bg-red-500" : "bg-gray-500"}`} />
                    <span className="font-mono text-xs text-gray-500">{inc.incident_number}</span>
                    <span className={`rounded px-2 py-0.5 text-xs ${inc.status === "Active" ? "bg-red-950/60 text-red-300" : "bg-gray-800 text-gray-400"}`}>
                      {inc.status}
                    </span>
                  </div>
                  <div className="mt-1 font-semibold">{inc.title}</div>
                  <div className="text-sm text-gray-500">{inc.type}{inc.staging_address ? ` • ${inc.staging_address}` : ""}</div>
                </div>
                <div className="shrink-0 text-sm font-medium text-red-400">Coordinate →</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
