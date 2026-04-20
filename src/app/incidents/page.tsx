"use client";

import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useEffect, useMemo, useState } from "react";

const CURRENT_TEST_EMAIL = "member2@matzilsar.org";
const CURRENT_MANAGER_EMAIL = "manager@matzilsar.org";

type ResponseUser = {
  full_name: string;
  call_sign: string;
};

type Response = {
  user_id: string;
  response_type: string;
  eta_minutes: number | null;
  available_at: string | null;
  responded_at: string | null;
  users: ResponseUser[] | null;
};

type Incident = {
  id: string;
  incident_number: string;
  title: string;
  type: string;
  short_description: string | null;
  status: string;
  accepting_units: boolean;
  incident_responses: Response[];
};

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [selectedHour, setSelectedHour] = useState("18");
  const [selectedMinute, setSelectedMinute] = useState("00");

  const hours = useMemo(
    () => Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0")),
    []
  );

  const minutes = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) =>
        (i * 5).toString().padStart(2, "0")
      ),
    []
  );

  useEffect(() => {
    loadPageData();

    if ("Notification" in window && Notification.permission !== "granted") {
      Notification.requestPermission();
    }

    const channel = supabase
      .channel("realtime-incidents")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "incident_responses" },
        () => {
          void loadPageData();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "incidents" },
        () => {
          void loadPageData();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  async function loadPageData() {
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("email", CURRENT_TEST_EMAIL)
      .single();

    if (user) setCurrentUserId(user.id);

    const { data, error } = await supabase
      .from("incidents")
      .select(`
        id,
        incident_number,
        title,
        type,
        short_description,
        status,
        accepting_units,
        incident_responses (
          user_id,
          response_type,
          eta_minutes,
          available_at,
          responded_at,
          users (
            full_name,
            call_sign
          )
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      alert(`Error loading incidents: ${error.message}`);
      return;
    }

    if (data) {
      setIncidents(data as unknown as Incident[]);
    }
  }

  async function respondToIncident(
    incidentId: string,
    type: "Responding" | "Not Available" | "Available At" | "Cancelled",
    availableTime?: string
  ) {
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("email", CURRENT_TEST_EMAIL)
      .single();

    if (!user) return;

    let availableAt: string | null = null;
    let etaMinutes: number | null = null;

    if (type === "Available At") {
      if (!availableTime) return;

      const [h, m] = availableTime.split(":");
      const d = new Date();
      d.setHours(Number(h), Number(m), 0, 0);
      availableAt = d.toISOString();
    }

    if (type === "Responding") {
      etaMinutes = 20;
    }

    await supabase.from("incident_responses").upsert(
      {
        incident_id: incidentId,
        user_id: user.id,
        response_type: type,
        eta_minutes: etaMinutes,
        available_at: availableAt,
        responded_at: new Date().toISOString(),
      },
      { onConflict: "incident_id,user_id" }
    );

    await loadPageData();
  }

  async function approveIncident(id: string) {
    const { data: manager } = await supabase
      .from("users")
      .select("id")
      .eq("email", CURRENT_MANAGER_EMAIL)
      .single();

    if (!manager) return;

    await supabase
      .from("incidents")
      .update({
        status: "Active",
        approved_by: manager.id,
        approved_at: new Date().toISOString(),
        activated_at: new Date().toISOString(),
        accepting_units: true,
      })
      .eq("id", id);

    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("🚨 SAR CALLOUT", {
        body: "New incident activated. Open app and respond.",
      });
    }

    await loadPageData();
  }

  async function stopUnits(id: string) {
    await supabase
      .from("incidents")
      .update({ accepting_units: false })
      .eq("id", id);

    await loadPageData();
  }

  function openTimePicker(id: string) {
    setSelectedIncidentId(id);
    setTimePickerOpen(true);
  }

  function saveTime() {
    if (!selectedIncidentId) return;

    void respondToIncident(
      selectedIncidentId,
      "Available At",
      `${selectedHour}:${selectedMinute}`
    );

    setTimePickerOpen(false);
  }

  function getMyResponse(incident: Incident) {
    return incident.incident_responses?.find(
      (r) => r.user_id === currentUserId
    );
  }

  function formatTime(date: string) {
    return new Date(date).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

  function formatResponse(r: Response) {
    if (r.response_type === "Responding" && r.responded_at && r.eta_minutes) {
      const d = new Date(r.responded_at);
      d.setMinutes(d.getMinutes() + r.eta_minutes);
      return `Responding • ETA ${formatTime(d.toISOString())}`;
    }

    if (r.response_type === "Available At" && r.available_at) {
      return `Available At • ${formatTime(r.available_at)}`;
    }

    return r.response_type;
  }

  function getResponseName(r: Response) {
    const user = r.users?.[0];
    if (!user) return "Unknown User";
    return `${user.call_sign} - ${user.full_name}`;
  }

  return (
    <>
      <main className="min-h-screen bg-black text-white p-6">
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Incidents</h1>
            <Link
              href="/"
              className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-2 text-sm"
            >
              Home
            </Link>
          </div>

          {incidents.map((incident) => {
            const myResponse = getMyResponse(incident);
            const active =
              myResponse && myResponse.response_type !== "Cancelled";

            return (
              <div key={incident.id} className="rounded-xl bg-gray-900 p-5">
                <div className="flex justify-between gap-4">
                  <div>
                    <div className="text-sm text-gray-400">
                      {incident.incident_number}
                    </div>
                    <div className="text-xl">{incident.title}</div>
                    {incident.short_description && (
                      <div className="mt-1 text-sm text-gray-400">
                        {incident.short_description}
                      </div>
                    )}
                  </div>

                  <div className="text-right text-sm">
                    <div>{incident.type}</div>
                    <div className="text-red-400">{incident.status}</div>
                  </div>
                </div>

                {incident.status === "Pending" && (
                  <button
                    onClick={() => void approveIncident(incident.id)}
                    className="mt-3 rounded bg-green-600 px-3 py-2"
                  >
                    Approve Incident
                  </button>
                )}

                {incident.status === "Active" && incident.accepting_units && (
                  <button
                    onClick={() => void stopUnits(incident.id)}
                    className="mt-3 rounded bg-orange-600 px-3 py-2"
                  >
                    No More Units
                  </button>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {incident.accepting_units ? (
                    <>
                      {!active ? (
                        <button
                          onClick={() =>
                            void respondToIncident(incident.id, "Responding")
                          }
                          className="rounded bg-red-600 px-3 py-2"
                        >
                          Respond
                        </button>
                      ) : (
                        <button
                          onClick={() =>
                            void respondToIncident(incident.id, "Cancelled")
                          }
                          className="rounded bg-yellow-600 px-3 py-2"
                        >
                          Cancel
                        </button>
                      )}

                      <button
                        onClick={() =>
                          void respondToIncident(incident.id, "Not Available")
                        }
                        className="rounded bg-gray-600 px-3 py-2"
                      >
                        Not Available
                      </button>

                      <button
                        onClick={() => openTimePicker(incident.id)}
                        className="rounded bg-blue-600 px-3 py-2"
                      >
                        Available At
                      </button>
                    </>
                  ) : (
                    <div className="text-orange-400">
                      No more units requested
                    </div>
                  )}
                </div>

                {myResponse && (
                  <div className="mt-2 text-blue-300">
                    Your status: {formatResponse(myResponse)}
                  </div>
                )}

                <div className="mt-3 space-y-1">
                  {incident.incident_responses.map((r, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span>{getResponseName(r)}</span>
                      <span>{formatResponse(r)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {timePickerOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/80">
          <div className="rounded-xl bg-gray-900 p-6">
            <div className="mb-4 flex gap-2">
              <select
                value={selectedHour}
                onChange={(e) => setSelectedHour(e.target.value)}
                className="rounded bg-black px-3 py-2"
              >
                {hours.map((h) => (
                  <option key={h}>{h}</option>
                ))}
              </select>

              <select
                value={selectedMinute}
                onChange={(e) => setSelectedMinute(e.target.value)}
                className="rounded bg-black px-3 py-2"
              >
                {minutes.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </div>

            <button
              onClick={saveTime}
              className="rounded bg-blue-600 px-4 py-2"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </>
  );
}