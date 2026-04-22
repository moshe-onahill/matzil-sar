"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import RoleSwitcher from "@/components/RoleSwitcher";
import { supabase } from "@/lib/supabase";
import { getCurrentTestEmail, getStoredRole, UserRole } from "@/lib/dev-user";

type ActiveIncident = {
  id: string;
  incident_number: string;
  title: string;
  status: string;
  staging_name: string | null;
  staging_lat: number | null;
  staging_lng: number | null;
};

type LiveLocation = {
  id: string;
  incident_id: string | null;
  lat: number;
  lng: number;
  speed_mph: number | null;
  heading_degrees: number | null;
  is_moving: boolean | null;
  updated_at: string;
  user_id: string | null;
  users:
    | {
        full_name: string | null;
        call_sign: string | null;
      }[]
    | {
        full_name: string | null;
        call_sign: string | null;
      }
    | null;
};

type Vehicle = {
  id: string;
  name: string;
  vehicle_type: string | null;
  lat: number | null;
  lng: number | null;
  is_active: boolean | null;
  updated_at: string | null;
};

type CustomPin = {
  id: string;
  title: string;
  notes: string | null;
  lat: number;
  lng: number;
  created_at: string;
};

type FocusItem =
  | {
      kind: "incident";
      id: string;
      title: string;
      subtitle: string;
      lat: number;
      lng: number;
      color: "red";
    }
  | {
      kind: "responder";
      id: string;
      title: string;
      subtitle: string;
      lat: number;
      lng: number;
      color: "blue";
    }
  | {
      kind: "vehicle";
      id: string;
      title: string;
      subtitle: string;
      lat: number;
      lng: number;
      color: "yellow";
    }
  | {
      kind: "pin";
      id: string;
      title: string;
      subtitle: string;
      lat: number;
      lng: number;
      color: "black";
    };

export default function MapPage() {
  const [currentRole, setCurrentRole] = useState<UserRole>("Member");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [incidents, setIncidents] = useState<ActiveIncident[]>([]);
  const [responders, setResponders] = useState<LiveLocation[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [pins, setPins] = useState<CustomPin[]>([]);

  const [focus, setFocus] = useState<FocusItem | null>(null);

  const [pinTitle, setPinTitle] = useState("");
  const [pinNotes, setPinNotes] = useState("");
  const [pinLat, setPinLat] = useState("");
  const [pinLng, setPinLng] = useState("");
  const [creatingPin, setCreatingPin] = useState(false);

  useEffect(() => {
    void loadAll();

    const channel = supabase
      .channel("map-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "incidents" },
        () => void loadAll()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_locations" },
        () => void loadAll()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agency_vehicles" },
        () => void loadAll()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "custom_pins" },
        () => void loadAll()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  async function loadAll() {
    setCurrentRole(getStoredRole());

    const email = getCurrentTestEmail();

    const { data: me } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .single();

    if (me?.id) {
      setCurrentUserId(me.id);
    }

    const [incidentRes, responderRes, vehicleRes, pinRes] = await Promise.all([
      supabase
        .from("incidents")
        .select(
          "id, incident_number, title, status, staging_name, staging_lat, staging_lng"
        )
        .eq("status", "Active")
        .not("staging_lat", "is", null)
        .not("staging_lng", "is", null)
        .order("incident_number", { ascending: false }),

      supabase
        .from("live_locations")
        .select(`
          id,
          incident_id,
          lat,
          lng,
          speed_mph,
          heading_degrees,
          is_moving,
          updated_at,
          user_id,
          users (
            full_name,
            call_sign
          )
        `)
        .order("updated_at", { ascending: false }),

      supabase
        .from("agency_vehicles")
        .select("id, name, vehicle_type, lat, lng, is_active, updated_at")
        .eq("is_active", true)
        .order("name", { ascending: true }),

      supabase
        .from("custom_pins")
        .select("id, title, notes, lat, lng, created_at")
        .order("created_at", { ascending: false }),
    ]);

    setIncidents((incidentRes.data as ActiveIncident[]) ?? []);
    setResponders((responderRes.data as LiveLocation[]) ?? []);
    setVehicles((vehicleRes.data as Vehicle[]) ?? []);
    setPins((pinRes.data as CustomPin[]) ?? []);

    if (!focus) {
      const firstIncident = (incidentRes.data as ActiveIncident[] | null)?.find(
        (i) => i.staging_lat !== null && i.staging_lng !== null
      );

      if (
        firstIncident &&
        firstIncident.staging_lat !== null &&
        firstIncident.staging_lng !== null
      ) {
        setFocus({
          kind: "incident",
          id: firstIncident.id,
          title: firstIncident.title,
          subtitle: firstIncident.staging_name || firstIncident.incident_number,
          lat: firstIncident.staging_lat,
          lng: firstIncident.staging_lng,
          color: "red",
        });
      }
    }
  }

  function canManagePins() {
    return (
      currentRole === "SAR Manager" ||
      currentRole === "Global Admin" ||
      currentRole === "Dispatcher"
    );
  }

  function openInGoogleMaps(lat: number, lng: number) {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, "_blank");
  }

  async function createPin() {
    if (!canManagePins()) {
      alert("You do not have permission to create custom pins.");
      return;
    }

    if (!pinTitle.trim() || !pinLat.trim() || !pinLng.trim()) {
      alert("Title, latitude, and longitude are required.");
      return;
    }

    const lat = Number(pinLat);
    const lng = Number(pinLng);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      alert("Latitude and longitude must be valid numbers.");
      return;
    }

    setCreatingPin(true);

    const { error } = await supabase.from("custom_pins").insert({
      title: pinTitle.trim(),
      notes: pinNotes.trim() || null,
      lat,
      lng,
      created_by: currentUserId,
    });

    setCreatingPin(false);

    if (error) {
      alert(error.message);
      return;
    }

    setPinTitle("");
    setPinNotes("");
    setPinLat("");
    setPinLng("");
    await loadAll();
  }

  async function deletePin(id: string) {
    if (!canManagePins()) return;

    const confirmed = window.confirm("Delete this custom pin?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("custom_pins")
      .delete()
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    if (focus?.kind === "pin" && focus.id === id) {
      setFocus(null);
    }

    await loadAll();
  }

  function responderName(item: LiveLocation) {
    const u = Array.isArray(item.users) ? item.users[0] : item.users;
    return u?.call_sign
      ? `${u.call_sign}${u?.full_name ? ` - ${u.full_name}` : ""}`
      : u?.full_name || "Unknown responder";
  }

  const focusEmbedUrl = useMemo(() => {
    if (!focus) return null;
    return `https://www.google.com/maps?q=${focus.lat},${focus.lng}&z=14&output=embed`;
  }, [focus]);

  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Matzil SAR</p>
            <h1 className="text-3xl font-bold">Map</h1>
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

        <div className="rounded-xl bg-gray-900 p-4">
          <div className="mb-3 text-lg font-semibold">Legend</div>
          <div className="flex flex-wrap gap-3 text-sm">
            <div className="rounded bg-red-900/40 px-3 py-2 text-red-300">
              Red = Active Incidents
            </div>
            <div className="rounded bg-blue-900/40 px-3 py-2 text-blue-300">
              Blue = Responders
            </div>
            <div className="rounded bg-yellow-900/40 px-3 py-2 text-yellow-300">
              Yellow = Vehicles
            </div>
            <div className="rounded bg-gray-800 px-3 py-2 text-gray-200">
              Black = Custom Pins
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <div className="overflow-hidden rounded-xl bg-gray-900">
              <div className="border-b border-gray-800 px-4 py-3 text-lg font-semibold">
                Operations Focus
              </div>

              {focus ? (
                <div className="space-y-4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xl font-semibold">{focus.title}</div>
                      <div className="text-sm text-gray-400">
                        {focus.subtitle}
                      </div>
                      <div className="mt-1 text-sm text-gray-500">
                        {focus.lat}, {focus.lng}
                      </div>
                    </div>

                    <button
                      onClick={() => openInGoogleMaps(focus.lat, focus.lng)}
                      className="rounded bg-blue-600 px-4 py-2"
                    >
                      Navigate
                    </button>
                  </div>

                  <div className="overflow-hidden rounded-lg border border-gray-800">
                    {focusEmbedUrl ? (
                      <iframe
                        title="Focused map"
                        src={focusEmbedUrl}
                        className="h-[420px] w-full"
                      />
                    ) : (
                      <div className="p-6 text-gray-400">No map selected.</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-6 text-gray-400">
                  No active map items yet.
                </div>
              )}
            </div>

            {canManagePins() && (
              <div className="rounded-xl bg-gray-900 p-4">
                <div className="mb-3 text-lg font-semibold">Create Custom Pin</div>

                <div className="space-y-3">
                  <input
                    value={pinTitle}
                    onChange={(e) => setPinTitle(e.target.value)}
                    placeholder="Pin title"
                    className="w-full rounded bg-black px-3 py-2"
                  />

                  <textarea
                    value={pinNotes}
                    onChange={(e) => setPinNotes(e.target.value)}
                    placeholder="Notes (optional)"
                    rows={3}
                    className="w-full rounded bg-black px-3 py-2"
                  />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      value={pinLat}
                      onChange={(e) => setPinLat(e.target.value)}
                      placeholder="Latitude"
                      className="w-full rounded bg-black px-3 py-2"
                    />
                    <input
                      value={pinLng}
                      onChange={(e) => setPinLng(e.target.value)}
                      placeholder="Longitude"
                      className="w-full rounded bg-black px-3 py-2"
                    />
                  </div>

                  <button
                    onClick={() => void createPin()}
                    disabled={creatingPin}
                    className="w-full rounded bg-red-600 px-4 py-2"
                  >
                    {creatingPin ? "Creating..." : "Create Pin"}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-xl bg-gray-900 p-4">
              <div className="mb-3 text-lg font-semibold">Active Incidents</div>

              <div className="space-y-2">
                {incidents.length === 0 && (
                  <div className="text-gray-400">No active incidents.</div>
                )}

                {incidents.map((incident) => (
                  <button
                    key={incident.id}
                    onClick={() =>
                      incident.staging_lat !== null &&
                      incident.staging_lng !== null &&
                      setFocus({
                        kind: "incident",
                        id: incident.id,
                        title: incident.title,
                        subtitle:
                          incident.staging_name || incident.incident_number,
                        lat: incident.staging_lat,
                        lng: incident.staging_lng,
                        color: "red",
                      })
                    }
                    className="block w-full rounded bg-red-950/30 px-4 py-3 text-left hover:bg-red-950/50"
                  >
                    <div className="font-medium">{incident.title}</div>
                    <div className="text-sm text-gray-400">
                      {incident.incident_number}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-gray-900 p-4">
              <div className="mb-3 text-lg font-semibold">Responders</div>

              <div className="space-y-2">
                {responders.length === 0 && (
                  <div className="text-gray-400">No responder locations.</div>
                )}

                {responders.map((item) => (
                  <button
                    key={item.id}
                    onClick={() =>
                      setFocus({
                        kind: "responder",
                        id: item.id,
                        title: responderName(item),
                        subtitle: item.is_moving
                          ? `Moving • ${item.speed_mph ?? 0} mph`
                          : "Stationary / unknown",
                        lat: item.lat,
                        lng: item.lng,
                        color: "blue",
                      })
                    }
                    className="block w-full rounded bg-blue-950/30 px-4 py-3 text-left hover:bg-blue-950/50"
                  >
                    <div className="font-medium">{responderName(item)}</div>
                    <div className="text-sm text-gray-400">
                      {item.is_moving
                        ? `Moving • ${item.speed_mph ?? 0} mph`
                        : "Stationary / unknown"}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-gray-900 p-4">
              <div className="mb-3 text-lg font-semibold">Agency Vehicles</div>

              <div className="space-y-2">
                {vehicles.length === 0 && (
                  <div className="text-gray-400">No vehicle locations.</div>
                )}

                {vehicles.map((vehicle) => (
                  <button
                    key={vehicle.id}
                    onClick={() =>
                      vehicle.lat !== null &&
                      vehicle.lng !== null &&
                      setFocus({
                        kind: "vehicle",
                        id: vehicle.id,
                        title: vehicle.name,
                        subtitle: vehicle.vehicle_type || "Vehicle",
                        lat: vehicle.lat,
                        lng: vehicle.lng,
                        color: "yellow",
                      })
                    }
                    className="block w-full rounded bg-yellow-950/30 px-4 py-3 text-left hover:bg-yellow-950/50"
                  >
                    <div className="font-medium">{vehicle.name}</div>
                    <div className="text-sm text-gray-400">
                      {vehicle.vehicle_type || "Vehicle"}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-gray-900 p-4">
              <div className="mb-3 text-lg font-semibold">Custom Pins</div>

              <div className="space-y-2">
                {pins.length === 0 && (
                  <div className="text-gray-400">No custom pins.</div>
                )}

                {pins.map((pin) => (
                  <div
                    key={pin.id}
                    className="rounded bg-gray-800 px-4 py-3"
                  >
                    <button
                      onClick={() =>
                        setFocus({
                          kind: "pin",
                          id: pin.id,
                          title: pin.title,
                          subtitle: pin.notes || "Custom pin",
                          lat: pin.lat,
                          lng: pin.lng,
                          color: "black",
                        })
                      }
                      className="block w-full text-left"
                    >
                      <div className="font-medium">{pin.title}</div>
                      <div className="text-sm text-gray-400">
                        {pin.notes || "No notes"}
                      </div>
                    </button>

                    {canManagePins() && (
                      <button
                        onClick={() => void deletePin(pin.id)}
                        className="mt-2 rounded bg-red-900 px-3 py-1 text-sm"
                      >
                        Delete Pin
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}