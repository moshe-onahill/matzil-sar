"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getCurrentTestEmail, getStoredRole, UserRole } from "@/lib/dev-user";
import RoleSwitcher from "@/components/RoleSwitcher";

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

type IncidentUpdate = {
  id: string;
  update_type: string;
  title: string;
  body: string | null;
  created_at: string;
};

type Incident = {
  id: string;
  incident_number: string;
  title: string;
  type: string;
  short_description: string | null;
  status: string;
  accepting_units: boolean;
  staging_name: string | null;
  staging_address: string | null;
  staging_lat: number | null;
  staging_lng: number | null;
  incident_responses: Response[];
  incident_updates: IncidentUpdate[];
};

type TabKey = "overview" | "updates" | "responders" | "attachments";

export default function IncidentDetailPage() {
  const params = useParams<{ id: string }>();

  const [incidentId, setIncidentId] = useState<string | null>(null);
  const [incident, setIncident] = useState<Incident | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>("Member");
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [actionsOpen, setActionsOpen] = useState(false);

  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [selectedHour, setSelectedHour] = useState("18");
  const [selectedMinute, setSelectedMinute] = useState("00");

  const [updateType, setUpdateType] = useState("General Update");
  const [updateTitle, setUpdateTitle] = useState("");
  const [updateBody, setUpdateBody] = useState("");
  const [postingUpdate, setPostingUpdate] = useState(false);

  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

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
    if (params?.id) {
      setIncidentId(params.id);
    }
  }, [params]);

  useEffect(() => {
    if (!incidentId) return;

    void loadPageData();

    const channel = supabase
      .channel(`incident-detail-${incidentId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "incident_responses" },
        () => void loadPageData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "incident_updates" },
        () => void loadPageData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "incidents" },
        () => void loadPageData()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [incidentId]);

  async function loadPageData() {
    if (!incidentId) return;

    setLoading(true);
    setPageError(null);
    setCurrentUserRole(getStoredRole());

    const email = getCurrentTestEmail();

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .single();

    if (userError || !user) {
      setLoading(false);
      setPageError("Could not load current user.");
      return;
    }

    setCurrentUserId(user.id);

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
        staging_name,
        staging_address,
        staging_lat,
        staging_lng,
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
        ),
        incident_updates (
          id,
          update_type,
          title,
          body,
          created_at
        )
      `)
      .eq("id", incidentId)
      .single();

    if (error || !data) {
      setLoading(false);
      setPageError(error?.message || "Incident not found.");
      return;
    }

    setIncident(data as unknown as Incident);
    setLoading(false);
  }

  async function approveIncident() {
    if (
      !incidentId ||
      (currentUserRole !== "SAR Manager" &&
        currentUserRole !== "Global Admin")
    ) {
      return;
    }

    const { error } = await supabase
      .from("incidents")
      .update({
        status: "Active",
        accepting_units: true,
      })
      .eq("id", incidentId);

    if (error) {
      alert(`Approval error: ${error.message}`);
      return;
    }

    setActionsOpen(false);
    await loadPageData();
  }

  async function closeIncident() {
    if (
      !incidentId ||
      (currentUserRole !== "SAR Manager" &&
        currentUserRole !== "Global Admin")
    ) {
      return;
    }

    const { error } = await supabase
      .from("incidents")
      .update({
        status: "Closed",
        accepting_units: false,
      })
      .eq("id", incidentId);

    if (error) {
      alert(`Close error: ${error.message}`);
      return;
    }

    setActionsOpen(false);
    await loadPageData();
  }

  async function stopUnits() {
    if (
      !incidentId ||
      (currentUserRole !== "SAR Manager" &&
        currentUserRole !== "Global Admin")
    ) {
      return;
    }

    const { error } = await supabase
      .from("incidents")
      .update({
        accepting_units: false,
      })
      .eq("id", incidentId);

    if (error) {
      alert(`No More Units error: ${error.message}`);
      return;
    }

    setActionsOpen(false);
    await loadPageData();
  }

  async function deleteIncident() {
    if (!incidentId || currentUserRole !== "Global Admin") {
      return;
    }

    const confirmed = window.confirm(
      "Delete this incident? This cannot be undone."
    );
    if (!confirmed) return;

    const { error } = await supabase
      .from("incidents")
      .delete()
      .eq("id", incidentId);

    if (error) {
      alert(`Delete error: ${error.message}`);
      return;
    }

    window.location.href = "/incidents";
  }

  async function respondToIncident(
    type: "Responding" | "Not Available" | "Available At" | "Cancelled",
    availableTime?: string
  ) {
    if (!incidentId || !currentUserId) return;

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

    const { error } = await supabase.from("incident_responses").upsert(
      {
        incident_id: incidentId,
        user_id: currentUserId,
        response_type: type,
        eta_minutes: etaMinutes,
        available_at: availableAt,
        responded_at: new Date().toISOString(),
      },
      { onConflict: "incident_id,user_id" }
    );

    if (error) {
      alert(`Response error: ${error.message}`);
      return;
    }

    await loadPageData();
  }

  async function postUpdate() {
    if (!incidentId || !currentUserId) return;

    if (
      currentUserRole !== "SAR Manager" &&
      currentUserRole !== "Global Admin"
    ) {
      alert("You do not have permission to post updates.");
      return;
    }

    if (!updateTitle.trim()) {
      alert("Update title is required.");
      return;
    }

    setPostingUpdate(true);

    const { error } = await supabase.from("incident_updates").insert({
      incident_id: incidentId,
      update_type: updateType,
      title: updateTitle.trim(),
      body: updateBody.trim() || null,
      created_by: currentUserId,
    });

    setPostingUpdate(false);

    if (error) {
      alert(`Update error: ${error.message}`);
      return;
    }

    setUpdateType("General Update");
    setUpdateTitle("");
    setUpdateBody("");
    await loadPageData();
  }

  function saveTime() {
    void respondToIncident(
      "Available At",
      `${selectedHour}:${selectedMinute}`
    );
    setTimePickerOpen(false);
  }

  function getMyResponse() {
    if (!incident || !currentUserId) return null;

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

  function formatDateTime(date: string) {
    const d = new Date(date);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })}`;
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

  function tabButtonClass(tab: TabKey) {
    return activeTab === tab
      ? "rounded-lg bg-red-600 px-4 py-2 text-sm"
      : "rounded-lg bg-gray-800 px-4 py-2 text-sm";
  }

  function openNavigation() {
    const currentIncident = incident;

    if (
      !currentIncident ||
      currentIncident.staging_lat === null ||
      currentIncident.staging_lng === null
    ) {
      alert("No staging coordinates available.");
      return;
    }

    const url = `https://www.google.com/maps/dir/?api=1&destination=${currentIncident.staging_lat},${currentIncident.staging_lng}`;
    window.open(url, "_blank");
  }

  function canShowActions() {
    return (
      currentUserRole === "SAR Manager" ||
      currentUserRole === "Global Admin" ||
      currentUserRole === "Dispatcher"
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-4 py-5 text-white sm:p-6">
        <div className="mx-auto max-w-4xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link
              href="/incidents"
              className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-2 text-sm"
            >
              Back
            </Link>
            <RoleSwitcher />
          </div>

          <div className="rounded-xl bg-gray-900 p-5 text-gray-400">
            Loading incident...
          </div>
        </div>
      </main>
    );
  }

  if (pageError) {
    return (
      <main className="min-h-screen bg-black px-4 py-5 text-white sm:p-6">
        <div className="mx-auto max-w-4xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link
              href="/incidents"
              className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-2 text-sm"
            >
              Back
            </Link>
            <RoleSwitcher />
          </div>

          <div className="rounded-xl bg-gray-900 p-5 text-red-300">
            {pageError}
          </div>
        </div>
      </main>
    );
  }

  if (!incident) return null;

  const myResponse = getMyResponse();
  const hasNonCancelledResponse =
    myResponse && myResponse.response_type !== "Cancelled";

  const canJoin = incident.status === "Active" && incident.accepting_units;
  const canCancel = myResponse && myResponse.response_type !== "Cancelled";

  return (
    <>
      <main className="min-h-screen bg-black px-4 py-5 text-white sm:p-6">
        <div className="mx-auto max-w-4xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link
              href="/incidents"
              className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-2 text-sm"
            >
              Back
            </Link>
            <RoleSwitcher />
          </div>

          <div className="rounded-xl bg-gray-900 p-4 sm:p-5">
            <div className="space-y-4">
              <div className="min-w-0">
                <div className="text-sm text-gray-400">
                  {incident.incident_number}
                </div>
                <div className="mt-1 break-words text-3xl font-bold leading-tight sm:text-2xl">
                  {incident.title}
                </div>
                {incident.short_description && (
                  <div className="mt-3 break-words text-base leading-relaxed text-gray-400">
                    {incident.short_description}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="text-sm">
                  <div>{incident.type}</div>
                  <div className="mt-1 text-red-400">{incident.status}</div>
                  {!incident.accepting_units &&
                    incident.status === "Active" && (
                      <div className="mt-1 text-orange-400">
                        No more units
                      </div>
                    )}
                </div>

                {canShowActions() && (
                  <div className="relative">
                    <button
                      onClick={() => setActionsOpen((prev) => !prev)}
                      className="rounded bg-gray-800 px-4 py-2"
                    >
                      Actions ▼
                    </button>

                    {actionsOpen && (
                      <div className="absolute right-0 z-20 mt-2 w-56 max-w-[calc(100vw-2rem)] rounded-lg border border-gray-800 bg-black p-2 shadow-xl">
                        <Link
                          href={`/incidents/${incident.id}/edit`}
                          className="block rounded px-3 py-2 text-left hover:bg-gray-900"
                        >
                          Edit Incident
                        </Link>

                        {incident.status === "Pending" &&
                          (currentUserRole === "SAR Manager" ||
                            currentUserRole === "Global Admin") && (
                            <button
                              onClick={() => void approveIncident()}
                              className="block w-full rounded px-3 py-2 text-left hover:bg-gray-900"
                            >
                              Approve Incident
                            </button>
                          )}

                        {incident.status === "Active" &&
                          incident.accepting_units &&
                          (currentUserRole === "SAR Manager" ||
                            currentUserRole === "Global Admin") && (
                            <button
                              onClick={() => void stopUnits()}
                              className="block w-full rounded px-3 py-2 text-left hover:bg-gray-900"
                            >
                              No More Units
                            </button>
                          )}

                        {incident.status !== "Closed" &&
                          (currentUserRole === "SAR Manager" ||
                            currentUserRole === "Global Admin") && (
                            <button
                              onClick={() => void closeIncident()}
                              className="block w-full rounded px-3 py-2 text-left hover:bg-gray-900"
                            >
                              Close Incident
                            </button>
                          )}

                        {currentUserRole === "Global Admin" && (
                          <button
                            onClick={() => void deleteIncident()}
                            className="block w-full rounded px-3 py-2 text-left text-red-300 hover:bg-gray-900"
                          >
                            Delete Incident
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="rounded-lg bg-black/30 p-4">
                <div className="text-sm text-gray-400">Staging Location</div>
                <div className="mt-1 break-words font-medium">
                  {incident.staging_name || "No staging name set"}
                </div>

                {incident.staging_address && (
                  <div className="mt-2 break-words text-sm text-gray-400">
                    {incident.staging_address}
                  </div>
                )}

                {incident.staging_lat !== null &&
                incident.staging_lng !== null ? (
                  <>
                    <div className="mt-2 break-words text-sm text-gray-400">
                      {incident.staging_lat}, {incident.staging_lng}
                    </div>

                    <button
                      onClick={openNavigation}
                      className="mt-3 rounded bg-blue-600 px-4 py-2"
                    >
                      Navigate
                    </button>
                  </>
                ) : (
                  <div className="mt-2 text-sm text-gray-500">
                    No staging coordinates set
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <button
                  onClick={() => setActiveTab("overview")}
                  className={tabButtonClass("overview")}
                >
                  Overview
                </button>

                <button
                  onClick={() => setActiveTab("updates")}
                  className={tabButtonClass("updates")}
                >
                  Updates
                </button>

                <button
                  onClick={() => setActiveTab("responders")}
                  className={tabButtonClass("responders")}
                >
                  Responders
                </button>

                <button
                  onClick={() => setActiveTab("attachments")}
                  className={tabButtonClass("attachments")}
                >
                  Attachments
                </button>
              </div>
            </div>
          </div>

          {activeTab === "overview" && (
            <div className="rounded-xl bg-gray-900 p-5">
              <div className="flex flex-wrap gap-2">
                {canJoin ? (
                  <>
                    {!hasNonCancelledResponse ? (
                      <button
                        onClick={() => void respondToIncident("Responding")}
                        className="rounded bg-red-600 px-3 py-2"
                      >
                        Respond
                      </button>
                    ) : (
                      <button
                        onClick={() => void respondToIncident("Cancelled")}
                        className="rounded bg-yellow-600 px-3 py-2"
                      >
                        Cancel Response
                      </button>
                    )}

                    <button
                      onClick={() => void respondToIncident("Not Available")}
                      className="rounded bg-gray-600 px-3 py-2"
                    >
                      Not Available
                    </button>

                    <button
                      onClick={() => setTimePickerOpen(true)}
                      className="rounded bg-blue-600 px-3 py-2"
                    >
                      Available At
                    </button>
                  </>
                ) : canCancel ? (
                  <button
                    onClick={() => void respondToIncident("Cancelled")}
                    className="rounded bg-yellow-600 px-3 py-2"
                  >
                    Cancel Response
                  </button>
                ) : (
                  <div className="text-orange-400">
                    {incident.status === "Pending"
                      ? "Waiting for manager approval"
                      : incident.status === "Closed"
                      ? "Incident closed"
                      : "No more units requested"}
                  </div>
                )}
              </div>

              {myResponse && (
                <div className="mt-3 text-blue-300">
                  Your status: {formatResponse(myResponse)}
                </div>
              )}
            </div>
          )}

          {activeTab === "updates" && (
            <div className="rounded-xl bg-gray-900 p-5">
              <div className="mb-3 text-lg font-semibold">Updates Log</div>

              {(currentUserRole === "SAR Manager" ||
                currentUserRole === "Global Admin") && (
                <div className="mb-4 space-y-3 rounded-lg bg-black/30 p-4">
                  <div className="text-sm text-gray-400">Post New Update</div>

                  <select
                    value={updateType}
                    onChange={(e) => setUpdateType(e.target.value)}
                    className="w-full rounded bg-black px-3 py-2"
                  >
                    <option>General Update</option>
                    <option>Team Movement</option>
                    <option>Patient Contact</option>
                    <option>Transport Requested</option>
                    <option>Scene Safety</option>
                  </select>

                  <input
                    value={updateTitle}
                    onChange={(e) => setUpdateTitle(e.target.value)}
                    placeholder="Update title"
                    className="w-full rounded bg-black px-3 py-2"
                  />

                  <textarea
                    value={updateBody}
                    onChange={(e) => setUpdateBody(e.target.value)}
                    placeholder="Update details"
                    className="w-full rounded bg-black px-3 py-2"
                    rows={4}
                  />

                  <button
                    onClick={() => void postUpdate()}
                    disabled={postingUpdate}
                    className="rounded bg-red-600 px-4 py-2"
                  >
                    {postingUpdate ? "Posting..." : "Post Update"}
                  </button>
                </div>
              )}

              <div className="space-y-3">
                {incident.incident_updates.length === 0 ? (
                  <div className="text-gray-400">No updates yet.</div>
                ) : (
                  incident.incident_updates
                    .slice()
                    .sort(
                      (a, b) =>
                        new Date(b.created_at).getTime() -
                        new Date(a.created_at).getTime()
                    )
                    .map((update) => (
                      <div
                        key={update.id}
                        className="rounded-lg bg-black/30 px-4 py-3"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:gap-4">
                          <div>
                            <div className="text-sm text-red-300">
                              {update.update_type}
                            </div>
                            <div className="mt-1 font-semibold">
                              {update.title}
                            </div>
                          </div>

                          <div className="text-sm text-gray-400">
                            {formatDateTime(update.created_at)}
                          </div>
                        </div>

                        {update.body && (
                          <div className="mt-2 whitespace-pre-wrap text-gray-300">
                            {update.body}
                          </div>
                        )}
                      </div>
                    ))
                )}
              </div>
            </div>
          )}

          {activeTab === "responders" && (
            <div className="rounded-xl bg-gray-900 p-5">
              <div className="mb-3 text-lg font-semibold">Responders</div>

              <div className="space-y-2">
                {incident.incident_responses.length === 0 ? (
                  <div className="text-gray-400">No responders yet.</div>
                ) : (
                  incident.incident_responses.map((response, index) => (
                    <div
                      key={index}
                      className="flex flex-col gap-2 rounded-lg bg-black/30 px-4 py-3 text-sm sm:flex-row sm:justify-between"
                    >
                      <span>{getResponseName(response)}</span>
                      <span className="text-gray-300">
                        {formatResponse(response)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === "attachments" && (
            <div className="rounded-xl bg-gray-900 p-5 text-gray-400">
              Attachments coming next.
            </div>
          )}
        </div>
      </main>

      {timePickerOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-sm rounded-xl bg-gray-900 p-6">
            <div className="mb-4 flex gap-2">
              <select
                value={selectedHour}
                onChange={(e) => setSelectedHour(e.target.value)}
                className="w-full rounded bg-black px-3 py-2"
              >
                {hours.map((h) => (
                  <option key={h}>{h}</option>
                ))}
              </select>

              <select
                value={selectedMinute}
                onChange={(e) => setSelectedMinute(e.target.value)}
                className="w-full rounded bg-black px-3 py-2"
              >
                {minutes.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setTimePickerOpen(false)}
                className="w-full rounded bg-gray-700 px-4 py-2"
              >
                Cancel
              </button>

              <button
                onClick={saveTime}
                className="w-full rounded bg-blue-600 px-4 py-2"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}