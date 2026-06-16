"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Incident = {
  id: string;
  title: string;
  incident_number: string;
  type: string;
  staging_address: string | null;
};

export default function AdminDashboardRedirectPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const { data } = await supabase
      .from("incidents")
      .select("id,title,incident_number,type,staging_address")
      .eq("status", "Active")
      .order("created_at", { ascending: false });

    const rows = (data ?? []) as Incident[];

    if (rows.length === 1) {
      window.location.replace(`/admin/incidents/${rows[0].id}/dashboard`);
      return;
    }

    setIncidents(rows);
    setLoading(false);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-red-500" />
      </main>
    );
  }

  if (incidents.length === 0) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <div className="text-zinc-500 text-lg">No active incidents</div>
        <Link href="/admin/incidents" className="rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700">
          View All Incidents
        </Link>
      </main>
    );
  }

  return (
    <main className="p-8">
      <div className="mx-auto max-w-xl space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-zinc-50">Command Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-500">Select an active incident to open its dashboard</p>
        </div>
        <div className="space-y-2">
          {incidents.map((inc) => (
            <Link key={inc.id} href={`/admin/incidents/${inc.id}/dashboard`}
              className="flex items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4 hover:bg-zinc-800 transition">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
                  <span className="font-mono text-xs text-zinc-500">{inc.incident_number}</span>
                </div>
                <div className="mt-1 font-semibold text-zinc-100">{inc.title}</div>
                <div className="text-sm text-zinc-500">{inc.type}{inc.staging_address ? ` · ${inc.staging_address}` : ""}</div>
              </div>
              <span className="shrink-0 text-sm text-zinc-400">Open Dashboard →</span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
