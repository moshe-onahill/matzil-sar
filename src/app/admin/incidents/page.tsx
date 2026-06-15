"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const LAST_INCIDENT_KEY = "admin-last-incident";

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
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => { void load(); }, [filter]);

  async function load() {
    setLoading(true);
    let q = supabase.from("incidents").select("id,title,incident_number,type,status,created_at,staging_address").order("created_at", { ascending: false });
    if (filter === "Active") q = q.eq("status", "Active");
    const { data } = await q;
    const rows = (data as Incident[]) ?? [];

    const active = rows.filter((i) => i.status === "Active");

    // Auto-nav: only one active → go straight to it
    if (filter === "Active" && active.length === 1) {
      setRedirecting(true);
      window.location.replace(`/admin/incidents/${active[0].id}`);
      return;
    }

    // Resume last visited incident if it's still in the list
    const lastId = sessionStorage.getItem(LAST_INCIDENT_KEY);
    if (filter === "Active" && lastId && rows.some((i) => i.id === lastId)) {
      setRedirecting(true);
      window.location.replace(`/admin/incidents/${lastId}`);
      return;
    }

    setIncidents(rows);
    setLoading(false);
  }

  if (redirecting || loading) {
    return (
      <main className="p-6 lg:p-8 flex items-center justify-center min-h-64">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-red-500" />
      </main>
    );
  }

  return (
    <main className="p-6 lg:p-8">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-zinc-50">Incident Coordination</h1>
          <div className="flex gap-2">
            {(["Active", "All"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`rounded-lg px-3 py-1.5 text-sm transition ${filter === f ? "bg-red-600 text-white" : "border border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {incidents.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-500">
            No {filter === "Active" ? "active " : ""}incidents.
          </div>
        ) : (
          <div className="space-y-2">
            {incidents.map((inc) => (
              <Link key={inc.id} href={`/admin/incidents/${inc.id}`}
                className="flex items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4 hover:bg-zinc-800 transition">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${inc.status === "Active" ? "bg-red-500" : "bg-zinc-500"}`} />
                    <span className="font-mono text-xs text-zinc-500">{inc.incident_number}</span>
                    <span className={`rounded-md px-2 py-0.5 text-xs ${inc.status === "Active" ? "bg-red-950/60 text-red-300" : "bg-zinc-800 text-zinc-400"}`}>
                      {inc.status}
                    </span>
                  </div>
                  <div className="mt-1 font-semibold text-zinc-100">{inc.title}</div>
                  <div className="text-sm text-zinc-500">{inc.type}{inc.staging_address ? ` · ${inc.staging_address}` : ""}</div>
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
