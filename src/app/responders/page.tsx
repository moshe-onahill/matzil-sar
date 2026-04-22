"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import RoleSwitcher from "@/components/RoleSwitcher";

type ResponderRow = {
  id: string;
  full_name: string | null;
  call_sign: string | null;
  is_active: boolean | null;
  user_units: {
    units: { name: string }[] | { name: string } | null;
  }[];
};

type ResponseRow = {
  user_id: string;
  incident_id: string;
  response_type: string;
  eta_minutes: number | null;
  available_at: string | null;
  responded_at: string | null;
  incidents:
    | {
        id: string;
        incident_number: string;
        title: string;
        status: string;
      }[]
    | {
        id: string;
        incident_number: string;
        title: string;
        status: string;
      }
    | null;
};

type LiveLocationRow = {
  user_id: string;
  updated_at: string;
  is_moving: boolean | null;
  speed_mph: number | null;
};

type ResponderView = {
  id: string;
  full_name: string;
  call_sign: string;
  units: string[];
  response_type: string | null;
  eta_minutes: number | null;
  available_at: string | null;
  responded_at: string | null;
  incident:
    | {
        id: string;
        incident_number: string;
        title: string;
        status: string;
      }
    | null;
  last_location_at: string | null;
  is_moving: boolean | null;
  speed_mph: number | null;
};

export default function RespondersPage() {
  const [responders, setResponders] = useState<ResponderView[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  useEffect(() => {
    void loadPage();

    const channel = supabase
      .channel("responders-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "users" },
        () => void loadPage()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "incident_responses" },
        () => void loadPage()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_locations" },
        () => void loadPage()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  async function loadPage() {
    const [usersRes, responsesRes, locationsRes] = await Promise.all([
      supabase
        .from("users")
        .select(`
          id,
          full_name,
          call_sign,
          is_active,
          user_units (
            units (
              name
            )
          )
        `)
        .eq("is_active", true)
        .order("full_name", { ascending: true }),

      supabase
        .from("incident_responses")
        .select(`
          user_id,
          incident_id,
          response_type,
          eta_minutes,
          available_at,
          responded_at,
          incidents (
            id,
            incident_number,
            title,
            status
          )
        `)
        .neq("response_type", "Cancelled")
        .order("responded_at", { ascending: false }),

      supabase
        .from("live_locations")
        .select(`
          user_id,
          updated_at,
          is_moving,
          speed_mph
        `)
        .order("updated_at", { ascending: false }),
    ]);

    const users = (usersRes.data as ResponderRow[]) ?? [];
    const responses = (responsesRes.data as ResponseRow[]) ?? [];
    const locations = (locationsRes.data as LiveLocationRow[]) ?? [];

    const latestResponseByUser = new Map<string, ResponseRow>();
    for (const response of responses) {
      if (!latestResponseByUser.has(response.user_id)) {
        latestResponseByUser.set(response.user_id, response);
      }
    }

    const latestLocationByUser = new Map<string, LiveLocationRow>();
    for (const location of locations) {
      if (!latestLocationByUser.has(location.user_id)) {
        latestLocationByUser.set(location.user_id, location);
      }
    }

    const merged: ResponderView[] = users.map((user) => {
      const response = latestResponseByUser.get(user.id) ?? null;
      const location = latestLocationByUser.get(user.id) ?? null;

      const units = extractNames(user.user_units ?? [], "units");

      let incident: ResponderView["incident"] = null;
      if (response?.incidents) {
        if (Array.isArray(response.incidents)) {
          incident = response.incidents[0] ?? null;
        } else {
          incident = response.incidents;
        }
      }

      return {
        id: user.id,
        full_name: user.full_name || "Unknown",
        call_sign: user.call_sign || "No Call Sign",
        units,
        response_type: response?.response_type ?? null,
        eta_minutes: response?.eta_minutes ?? null,
        available_at: response?.available_at ?? null,
        responded_at: response?.responded_at ?? null,
        incident,
        last_location_at: location?.updated_at ?? null,
        is_moving: location?.is_moving ?? null,
        speed_mph: location?.speed_mph ?? null,
      };
    });

    setResponders(merged);
  }

  function extractNames(items: any[], key: "units") {
    return items.flatMap((item) => {
      const value = item?.[key];
      if (Array.isArray(value)) return value.map((x) => x?.name).filter(Boolean);
      if (value?.name) return [value.name];
      return [];
    });
  }

  function formatResponseLabel(row: ResponderView) {
    if (!row.response_type) return "Not responding";

    if (row.response_type === "Responding") {
      if (row.eta_minutes !== null) {
        return `Responding • ETA ${row.eta_minutes} min`;
      }
      return "Responding";
    }

    if (row.response_type === "Available At") {
      if (row.available_at) {
        return `Available At • ${new Date(row.available_at).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}`;
      }
      return "Available At";
    }

    return row.response_type;
  }

  function formatLocationLabel(row: ResponderView) {
    if (!row.last_location_at) return "No live location";
    if (row.is_moving) {
      return `Moving${row.speed_mph ? ` • ${row.speed_mph} mph` : ""}`;
    }
    return "Stationary / last known";
  }

  const filtered = useMemo(() => {
    return responders.filter((row) => {
      const q = search.toLowerCase();

      const matchesSearch =
        row.full_name.toLowerCase().includes(q) ||
        row.call_sign.toLowerCase().includes(q) ||
        row.units.join(", ").toLowerCase().includes(q);

      const normalizedStatus = row.response_type ?? "None";
      const matchesStatus =
        statusFilter === "All" ||
        (statusFilter === "None" && normalizedStatus === "None") ||
        normalizedStatus === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [responders, search, statusFilter]);

  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Matzil SAR</p>
            <h1 className="text-3xl font-bold">Responders</h1>
          </div>

          <div className="flex items-center gap-3">
            <RoleSwitcher />
            <Link
              href="/"
              className="rounded border border-gray-800 bg-gray-900 px-4 py-2"
            >
              Dashboard
            </Link>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, call sign, or unit"
            className="rounded bg-gray-900 px-3 py-2"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded bg-gray-900 px-3 py-2"
          >
            <option>All</option>
            <option>None</option>
            <option>Responding</option>
            <option>Available At</option>
            <option>Not Available</option>
          </select>
        </div>

        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="rounded-xl bg-gray-900 p-5 text-gray-400">
              No responders found.
            </div>
          )}

          {filtered.map((row) => (
            <div
              key={row.id}
              className="rounded-xl bg-gray-900 p-5"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-xl font-medium">{row.call_sign}</div>
                  <div className="text-sm text-gray-400">{row.full_name}</div>
                  <div className="mt-2 text-sm text-gray-400">
                    Units: {row.units.length ? row.units.join(", ") : "None"}
                  </div>
                </div>

                <div className="text-sm md:text-right">
                  <div className="text-blue-300">{formatResponseLabel(row)}</div>
                  <div className="mt-1 text-gray-400">
                    {formatLocationLabel(row)}
                  </div>

                  {row.last_location_at && (
                    <div className="mt-1 text-gray-500">
                      Updated{" "}
                      {new Date(row.last_location_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  )}
                </div>
              </div>

              {row.incident && (
                <div className="mt-4 rounded-lg bg-black/30 p-4">
                  <div className="text-sm text-gray-400">Assigned Incident</div>
                  <div className="mt-1 font-medium">{row.incident.title}</div>
                  <div className="text-sm text-gray-400">
                    {row.incident.incident_number} • {row.incident.status}
                  </div>

                  <Link
                    href={`/incidents/${row.incident.id}`}
                    className="mt-3 inline-block rounded bg-red-600 px-4 py-2 text-sm"
                  >
                    Open Incident
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}