"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type AuditEntry = {
  id: string;
  created_at: string;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_label: string | null;
  details: Record<string, unknown> | null;
};

const ACTION_LABELS: Record<string, string> = {
  edit_member: "Edited member",
  approve_change_request: "Approved change request",
  reject_change_request: "Rejected change request",
  edit_incident: "Edited incident",
  create_incident: "Created incident",
  close_incident: "Closed incident",
  post_incident_update: "Posted incident update",
  edit_incident_update: "Edited incident update",
  delete_incident_update: "Deleted incident update",
  create_task: "Created task",
  edit_task: "Edited task",
  add_cert: "Added certification",
  remove_cert: "Removed certification",
  send_alert: "Sent alert",
  create_task: "Created task",
  post_event_update: "Posted event update",
};

const ACTION_COLORS: Record<string, string> = {
  edit_member: "text-blue-400 bg-blue-950/40",
  approve_change_request: "text-green-400 bg-green-950/40",
  reject_change_request: "text-red-400 bg-red-950/40",
  edit_incident: "text-orange-400 bg-orange-950/40",
  create_incident: "text-red-400 bg-red-950/40",
  close_incident: "text-zinc-400 bg-zinc-800/60",
  post_incident_update: "text-cyan-400 bg-cyan-950/40",
};

function actionColor(action: string) {
  return ACTION_COLORS[action] ?? "text-zinc-400 bg-zinc-800/40";
}

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  useEffect(() => {
    void load();
  }, [page, filterAction]);

  async function load() {
    setLoading(true);
    let q = supabase
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (filterAction) q = q.eq("action", filterAction);

    const { data } = await q;
    setEntries((data as AuditEntry[]) ?? []);
    setLoading(false);
  }

  const filtered = search
    ? entries.filter((e) =>
        [e.actor_name, e.action, e.entity_label, e.entity_type, JSON.stringify(e.details)]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase())
      )
    : entries;

  function fmt(iso: string) {
    return new Date(iso).toLocaleString([], {
      month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  }

  const uniqueActions = Array.from(new Set(entries.map((e) => e.action))).sort();

  return (
    <main className="p-6 lg:p-8">
      <div className="space-y-4 max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-zinc-50">Audit Log</h1>
          <div className="flex gap-2 flex-wrap">
            <select
              value={filterAction}
              onChange={(e) => { setFilterAction(e.target.value); setPage(0); }}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-zinc-500"
            >
              <option value="">All actions</option>
              {uniqueActions.map((a) => (
                <option key={a} value={a}>{ACTION_LABELS[a] ?? a}</option>
              ))}
            </select>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none w-52 focus:border-zinc-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="animate-pulse space-y-2">
            {[...Array(8)].map((_, i) => <div key={i} className="h-14 rounded-lg bg-zinc-800" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-6 py-16 text-center text-zinc-600">
            No audit entries found.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  <th className="px-4 py-3 w-44">Time</th>
                  <th className="px-4 py-3 w-36">Actor</th>
                  <th className="px-4 py-3 w-52">Action</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filtered.map((e) => (
                  <tr key={e.id} className="hover:bg-zinc-800/30 transition">
                    <td className="px-4 py-3 text-zinc-500 font-mono text-xs whitespace-nowrap">
                      {fmt(e.created_at)}
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-200 truncate max-w-[144px]">
                      {e.actor_name ?? <span className="text-zinc-600">Unknown</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${actionColor(e.action)}`}>
                        {ACTION_LABELS[e.action] ?? e.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-400 truncate max-w-[200px]">
                      {e.entity_label
                        ? <>{e.entity_label} {e.entity_type && <span className="text-zinc-600 text-xs">({e.entity_type})</span>}</>
                        : e.entity_type
                          ? <span className="text-zinc-600">{e.entity_type}</span>
                          : <span className="text-zinc-700">—</span>}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs font-mono truncate max-w-[240px]">
                      {e.details ? JSON.stringify(e.details) : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center gap-3 justify-end">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 disabled:opacity-40 hover:bg-zinc-700 transition"
          >
            ← Prev
          </button>
          <span className="text-sm text-zinc-500">Page {page + 1}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={filtered.length < PAGE_SIZE}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 disabled:opacity-40 hover:bg-zinc-700 transition"
          >
            Next →
          </button>
        </div>
      </div>
    </main>
  );
}
