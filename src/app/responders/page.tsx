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
        .eq("response_type", "Responding")
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

    const respondingUsers = users
      .filter((user) => latestResponseByUser.has(user.id))
      .map((user) => {
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

    setResponders(respondingUsers);
  }

  function extractNames(items: any[], key: "units") {
    return items.flatMap((item) => {
      const value = item?.[key];
      if (Array.isArray(value)) return value.map((x) => x?.name).filter(Boolean);
      if (value?.name) return [value.name];
      return [];
    });
  }

  function formatEta(row: ResponderView) {
  if (row.eta_minutes !== null && row.responded_at) {
    const eta = new Date(row.responded_at);
    eta.setMinutes(eta.getMinutes() + row.eta_minutes);

    return `ETA ${eta.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })}`;
  }

  return "Responding";
}

  function formatLocationLabel(row: ResponderView) {
    if (!row.last_location_at) return "No location";

    if (row.is_moving) {
      return `Moving${row.speed_mph ? ` • ${row.speed_mph} mph` : ""}`;
    }

    return "Stationary";
  }

  function formatUpdatedTime(row: ResponderView) {
    if (!row.last_location_at) return null;

    return new Date(row.last_location_at).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const filtered = useMemo(() => {
    return responders.filter((row) => {
      const q = search.toLowerCase();

      return (
        row.full_name.toLowerCase().includes(q) ||
        row.call_sign.toLowerCase().includes(q) ||
        row.units.join(", ").toLowerCase().includes(q) ||
        row.incident?.title.toLowerCase().includes(q) ||
        row.incident?.incident_number.toLowerCase().includes(q)
      );
    });
  }, [responders, search]);

  return (
    <main className="min-h-screen bg-black px-4 py-5 pb-28 text-white sm:p-6 sm:pb-28">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="space-y-3">
          <div>
            <p className="text-sm text-gray-500">Matzil SAR</p>
            <h1 className="text-4xl font-bold leading-tight sm:text-3xl">
              Responding Units
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <RoleSwitcher />

            <Link
              href="/"
              className="rounded border border-gray-800 bg-gray-900 px-4 py-2 text-sm"
            >
              Dashboard
            </Link>
          </div>
        </div>

        <div className="rounded-xl bg-gray-900 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm text-gray-400">Currently Responding</div>
              <div className="text-2xl font-bold">{filtered.length}</div>
            </div>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="w-40 rounded bg-black px-3 py-2 text-sm sm:w-64"
            />
          </div>
        </div>

        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className="rounded-xl bg-gray-900 p-5 text-gray-400">
              No units are currently responding.
            </div>
          )}

          {filtered.map((row) => (
            <div key={row.id} className="rounded-lg bg-gray-900 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="break-words text-lg font-semibold leading-tight">
                      {row.call_sign}
                    </div>

                    <span className="rounded bg-red-950/50 px-2 py-0.5 text-xs text-red-200">
                      {formatEta(row)}
                    </span>
                  </div>

                  <div className="mt-0.5 break-words text-sm text-gray-400">
                    {row.full_name}
                  </div>

                  <div className="mt-1 break-words text-xs text-gray-500">
                    {row.units.length ? row.units.join(", ") : "No unit listed"}
                  </div>
                </div>

                <div className="shrink-0 text-right text-xs text-gray-400">
                  <div>{formatLocationLabel(row)}</div>
                  {formatUpdatedTime(row) && (
                    <div className="mt-0.5 text-gray-500">
                      {formatUpdatedTime(row)}
                    </div>
                  )}
                </div>
              </div>

              {row.incident && (
                <Link
                  href={`/incidents/${row.incident.id}`}
                  className="mt-2 block rounded bg-black/30 px-3 py-2 text-sm"
                >
                  <div className="truncate font-medium">
                    {row.incident.title}
                  </div>
                  <div className="text-xs text-gray-500">
                    {row.incident.incident_number} • {row.incident.status}
                  </div>
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}