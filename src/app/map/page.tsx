"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import RoleSwitcher from "@/components/RoleSwitcher";
import { supabase } from "@/lib/supabase";
import { getCurrentTestEmail, getStoredRole, UserRole } from "@/lib/dev-user";

type ActiveIncident = {
  id: string;
  incident_number: string;
  title: string;
  status: string;
  staging_name: string | null;
  staging_address: string | null;
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
  address: string | null;
  lat: number;
  lng: number;
  created_at: string;
  created_by: string | null;
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

declare global {
  interface Window {
    L: any;
  }
}

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
  const [pinAddress, setPinAddress] = useState("");
  const [pinLat, setPinLat] = useState("");
  const [pinLng, setPinLng] = useState("");
  const [creatingPin, setCreatingPin] = useState(false);
  const [geocodingPin, setGeocodingPin] = useState(false);

  const [editingPinId, setEditingPinId] = useState<string | null>(null);
  const [editPinTitle, setEditPinTitle] = useState("");
  const [editPinNotes, setEditPinNotes] = useState("");
  const [editPinAddress, setEditPinAddress] = useState("");
  const [editPinLat, setEditPinLat] = useState("");
  const [editPinLng, setEditPinLng] = useState("");
  const [savingEditPin, setSavingEditPin] = useState(false);
  const [geocodingEditPin, setGeocodingEditPin] = useState(false);

  const mapRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const leafletReadyRef = useRef(false);

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

  useEffect(() => {
    void ensureLeafletAndInit();
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!leafletReadyRef.current || !window.L || !mapRef.current) return;
    renderMarkers();
  }, [incidents, responders, vehicles, pins]);

  useEffect(() => {
    if (!focus || !mapRef.current) return;
    mapRef.current.setView([focus.lat, focus.lng], 14);
  }, [focus]);

  async function ensureLeafletAndInit() {
    if (typeof window === "undefined") return;

    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    if (!window.L) {
      await new Promise<void>((resolve, reject) => {
        const existing = document.getElementById("leaflet-js");
        if (existing) {
          const wait = () => {
            if (window.L) resolve();
            else setTimeout(wait, 50);
          };
          wait();
          return;
        }

        const script = document.createElement("script");
        script.id = "leaflet-js";
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Failed to load Leaflet"));
        document.body.appendChild(script);
      });
    }

    if (!mapContainerRef.current || mapRef.current) {
      leafletReadyRef.current = true;
      return;
    }

    const L = window.L;

    mapRef.current = L.map(mapContainerRef.current, {
      zoomControl: true,
    }).setView([40.0979, -74.2176], 10);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(mapRef.current);

    markersLayerRef.current = L.layerGroup().addTo(mapRef.current);
    leafletReadyRef.current = true;
    renderMarkers();
  }

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
          "id, incident_number, title, status, staging_name, staging_address, staging_lat, staging_lng"
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
        .select("id, title, notes, address, lat, lng, created_at, created_by")
        .order("created_at", { ascending: false }),
    ]);

    const incidentData = (incidentRes.data as ActiveIncident[]) ?? [];
    const responderData = (responderRes.data as LiveLocation[]) ?? [];
    const vehicleData = (vehicleRes.data as Vehicle[]) ?? [];
    const pinData = (pinRes.data as CustomPin[]) ?? [];

    setIncidents(incidentData);
    setResponders(responderData);
    setVehicles(vehicleData);
    setPins(pinData);

    if (!focus) {
      const firstIncident = incidentData.find(
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
          subtitle:
            firstIncident.staging_name ||
            firstIncident.staging_address ||
            firstIncident.incident_number,
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

  function responderName(item: LiveLocation) {
    const u = Array.isArray(item.users) ? item.users[0] : item.users;
    return u?.call_sign
      ? `${u.call_sign}${u?.full_name ? ` - ${u.full_name}` : ""}`
      : u?.full_name || "Unknown responder";
  }

  function markerHtml(color: "red" | "blue" | "yellow" | "black", label: string) {
    const bg =
      color === "red"
        ? "#dc2626"
        : color === "blue"
        ? "#2563eb"
        : color === "yellow"
        ? "#ca8a04"
        : "#111111";

    return `
      <div style="display:flex;flex-direction:column;align-items:center;">
        <div style="
          width:18px;
          height:18px;
          border-radius:9999px;
          background:${bg};
          border:2px solid white;
          box-shadow:0 0 0 2px rgba(0,0,0,0.25);
        "></div>
        <div style="
          margin-top:4px;
          background:rgba(0,0,0,0.75);
          color:white;
          font-size:11px;
          padding:2px 6px;
          border-radius:9999px;
          white-space:nowrap;
          max-width:120px;
          overflow:hidden;
          text-overflow:ellipsis;
        ">${label}</div>
      </div>
    `;
  }

  function renderMarkers() {
    if (!window.L || !mapRef.current || !markersLayerRef.current) return;

    const L = window.L;
    markersLayerRef.current.clearLayers();

    const bounds: [number, number][] = [];

    incidents.forEach((incident) => {
      if (incident.staging_lat === null || incident.staging_lng === null) return;

      const item: FocusItem = {
        kind: "incident",
        id: incident.id,
        title: incident.title,
        subtitle:
          incident.staging_name ||
          incident.staging_address ||
          incident.incident_number,
        lat: incident.staging_lat,
        lng: incident.staging_lng,
        color: "red",
      };

      const icon = L.divIcon({
        className: "",
        html: markerHtml("red", incident.incident_number),
        iconSize: [120, 36],
        iconAnchor: [60, 18],
      });

      const marker = L.marker([item.lat, item.lng], { icon });
      marker.on("click", () => setFocus(item));
      marker.addTo(markersLayerRef.current);
      bounds.push([item.lat, item.lng]);
    });

    responders.forEach((responder) => {
      const item: FocusItem = {
        kind: "responder",
        id: responder.id,
        title: responderName(responder),
        subtitle: responder.is_moving
          ? `Moving • ${responder.speed_mph ?? 0} mph`
          : "Stationary / unknown",
        lat: responder.lat,
        lng: responder.lng,
        color: "blue",
      };

      const icon = L.divIcon({
        className: "",
        html: markerHtml("blue", responderName(responder)),
        iconSize: [140, 36],
        iconAnchor: [70, 18],
      });

      const marker = L.marker([item.lat, item.lng], { icon });
      marker.on("click", () => setFocus(item));
      marker.addTo(markersLayerRef.current);
      bounds.push([item.lat, item.lng]);
    });

    vehicles.forEach((vehicle) => {
      if (vehicle.lat === null || vehicle.lng === null) return;

      const item: FocusItem = {
        kind: "vehicle",
        id: vehicle.id,
        title: vehicle.name,
        subtitle: vehicle.vehicle_type || "Vehicle",
        lat: vehicle.lat,
        lng: vehicle.lng,
        color: "yellow",
      };

      const icon = L.divIcon({
        className: "",
        html: markerHtml("yellow", vehicle.name),
        iconSize: [120, 36],
        iconAnchor: [60, 18],
      });

      const marker = L.marker([item.lat, item.lng], { icon });
      marker.on("click", () => setFocus(item));
      marker.addTo(markersLayerRef.current);
      bounds.push([item.lat, item.lng]);
    });

    pins.forEach((pin) => {
      const item: FocusItem = {
        kind: "pin",
        id: pin.id,
        title: pin.title,
        subtitle: pin.notes || pin.address || "Custom pin",
        lat: pin.lat,
        lng: pin.lng,
        color: "black",
      };

      const icon = L.divIcon({
        className: "",
        html: markerHtml("black", pin.title),
        iconSize: [120, 36],
        iconAnchor: [60, 18],
      });

      const marker = L.marker([item.lat, item.lng], { icon });
      marker.on("click", () => setFocus(item));
      marker.addTo(markersLayerRef.current);
      bounds.push([item.lat, item.lng]);
    });

    if (bounds.length > 0) {
      const leafletBounds = L.latLngBounds(bounds);
      mapRef.current.fitBounds(leafletBounds, { padding: [30, 30] });
    }
  }

  async function geocodeAddressToFields(
    address: string,
    setLat: (v: string) => void,
    setLng: (v: string) => void,
    setBusy: (v: boolean) => void
  ) {
    if (!address.trim()) {
      alert("Enter an address first.");
      return;
    }

    setBusy(true);

    try {
      const encoded = encodeURIComponent(address.trim());
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encoded}`;

      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
        },
      });

      const data = await response.json();

      if (!Array.isArray(data) || data.length === 0) {
        alert("Address not found.");
        setBusy(false);
        return;
      }

      const lat = Number(data[0].lat);
      const lng = Number(data[0].lon);

      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        alert("Could not parse coordinates.");
        setBusy(false);
        return;
      }

      setLat(String(lat));
      setLng(String(lng));
    } catch {
      alert("Geocoding failed.");
    }

    setBusy(false);
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
      address: pinAddress.trim() || null,
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
    setPinAddress("");
    setPinLat("");
    setPinLng("");
    await loadAll();
  }

  function startEditPin(pin: CustomPin) {
    setEditingPinId(pin.id);
    setEditPinTitle(pin.title);
    setEditPinNotes(pin.notes || "");
    setEditPinAddress(pin.address || "");
    setEditPinLat(String(pin.lat));
    setEditPinLng(String(pin.lng));
  }

  function cancelEditPin() {
    setEditingPinId(null);
    setEditPinTitle("");
    setEditPinNotes("");
    setEditPinAddress("");
    setEditPinLat("");
    setEditPinLng("");
  }

  async function saveEditPin() {
    if (!editingPinId) return;

    if (!editPinTitle.trim() || !editPinLat.trim() || !editPinLng.trim()) {
      alert("Title, latitude, and longitude are required.");
      return;
    }

    const lat = Number(editPinLat);
    const lng = Number(editPinLng);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      alert("Latitude and longitude must be valid numbers.");
      return;
    }

    setSavingEditPin(true);

    const { error } = await supabase
      .from("custom_pins")
      .update({
        title: editPinTitle.trim(),
        notes: editPinNotes.trim() || null,
        address: editPinAddress.trim() || null,
        lat,
        lng,
      })
      .eq("id", editingPinId);

    setSavingEditPin(false);

    if (error) {
      alert(error.message);
      return;
    }

    cancelEditPin();
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

  return (
    <main className="min-h-screen bg-black p-4 sm:p-6 text-white">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex items-center justify-between gap-3">
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
                Operations Map
              </div>

              <div ref={mapContainerRef} className="h-[520px] w-full" />
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

                  <input
                    value={pinAddress}
                    onChange={(e) => setPinAddress(e.target.value)}
                    placeholder="Address (optional)"
                    className="w-full rounded bg-black px-3 py-2"
                  />

                  <button
                    onClick={() =>
                      void geocodeAddressToFields(
                        pinAddress,
                        setPinLat,
                        setPinLng,
                        setGeocodingPin
                      )
                    }
                    disabled={geocodingPin}
                    className="rounded bg-blue-600 px-4 py-2"
                  >
                    {geocodingPin ? "Getting Coordinates..." : "Get Coordinates From Address"}
                  </button>

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
              <div className="mb-3 text-lg font-semibold">Focused Item</div>

              {focus ? (
                <div className="space-y-3">
                  <div className="text-xl font-semibold">{focus.title}</div>
                  <div className="text-sm text-gray-400">{focus.subtitle}</div>
                  <div className="text-sm text-gray-500">
                    {focus.lat}, {focus.lng}
                  </div>

                  <button
                    onClick={() => openInGoogleMaps(focus.lat, focus.lng)}
                    className="rounded bg-blue-600 px-4 py-2"
                  >
                    Navigate
                  </button>
                </div>
              ) : (
                <div className="text-gray-400">
                  Click any marker to inspect it.
                </div>
              )}
            </div>

            <div className="rounded-xl bg-gray-900 p-4">
              <div className="mb-3 text-lg font-semibold">Custom Pins</div>

              <div className="space-y-2">
                {pins.length === 0 && (
                  <div className="text-gray-400">No custom pins.</div>
                )}

                {pins.map((pin) => (
                  <div key={pin.id} className="rounded bg-gray-800 px-4 py-3">
                    {editingPinId === pin.id ? (
                      <div className="space-y-3">
                        <input
                          value={editPinTitle}
                          onChange={(e) => setEditPinTitle(e.target.value)}
                          placeholder="Pin title"
                          className="w-full rounded bg-black px-3 py-2"
                        />

                        <textarea
                          value={editPinNotes}
                          onChange={(e) => setEditPinNotes(e.target.value)}
                          placeholder="Notes"
                          rows={3}
                          className="w-full rounded bg-black px-3 py-2"
                        />

                        <input
                          value={editPinAddress}
                          onChange={(e) => setEditPinAddress(e.target.value)}
                          placeholder="Address"
                          className="w-full rounded bg-black px-3 py-2"
                        />

                        <button
                          onClick={() =>
                            void geocodeAddressToFields(
                              editPinAddress,
                              setEditPinLat,
                              setEditPinLng,
                              setGeocodingEditPin
                            )
                          }
                          disabled={geocodingEditPin}
                          className="rounded bg-blue-600 px-4 py-2"
                        >
                          {geocodingEditPin ? "Getting Coordinates..." : "Get Coordinates From Address"}
                        </button>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <input
                            value={editPinLat}
                            onChange={(e) => setEditPinLat(e.target.value)}
                            placeholder="Latitude"
                            className="w-full rounded bg-black px-3 py-2"
                          />
                          <input
                            value={editPinLng}
                            onChange={(e) => setEditPinLng(e.target.value)}
                            placeholder="Longitude"
                            className="w-full rounded bg-black px-3 py-2"
                          />
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => void saveEditPin()}
                            disabled={savingEditPin}
                            className="rounded bg-green-600 px-4 py-2"
                          >
                            {savingEditPin ? "Saving..." : "Save"}
                          </button>
                          <button
                            onClick={cancelEditPin}
                            className="rounded bg-gray-700 px-4 py-2"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() =>
                            setFocus({
                              kind: "pin",
                              id: pin.id,
                              title: pin.title,
                              subtitle: pin.notes || pin.address || "Custom pin",
                              lat: pin.lat,
                              lng: pin.lng,
                              color: "black",
                            })
                          }
                          className="block w-full text-left"
                        >
                          <div className="font-medium">{pin.title}</div>
                          <div className="text-sm text-gray-400">
                            {pin.notes || pin.address || "No notes"}
                          </div>
                        </button>

                        {canManagePins() && (
                          <div className="mt-2 flex gap-2">
                            <button
                              onClick={() => startEditPin(pin)}
                              className="rounded bg-gray-700 px-3 py-1 text-sm"
                            >
                              Edit Pin
                            </button>
                            <button
                              onClick={() => void deletePin(pin.id)}
                              className="rounded bg-red-900 px-3 py-1 text-sm"
                            >
                              Delete Pin
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-gray-900 p-4">
              <div className="mb-3 text-lg font-semibold">Map Counts</div>
              <div className="space-y-2 text-sm text-gray-300">
                <div>Active incidents: {incidents.length}</div>
                <div>Responders: {responders.length}</div>
                <div>Vehicles: {vehicles.length}</div>
                <div>Custom pins: {pins.length}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}