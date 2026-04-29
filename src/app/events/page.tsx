"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentTestEmail } from "@/lib/dev-user";

type EventRow = {
  id: string;
  title: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  location_name: string | null;
  address: string | null;
  event_type: string | null;
  notes: string | null;
  status: string | null;
  created_at: string;
};

type IncidentRow = {
  id: string;
  title: string;
  incident_number: string;
  type: string;
  status: string;
  created_at: string;
  staging_name: string | null;
  staging_address: string | null;
};

type CalendarItem = {
  id: string;
  kind: "event" | "incident";
  title: string;
  date: string;
  subtitle: string;
  status: string;
  href?: string;
};

export default function EventsPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [upcomingOpen, setUpcomingOpen] = useState(false);

  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));

  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [locationName, setLocationName] = useState("");
  const [address, setAddress] = useState("");
  const [eventType, setEventType] = useState("Non-Emergency Event");
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    void loadData();

    const channel = supabase
      .channel("events-calendar-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events" },
        () => void loadData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "incidents" },
        () => void loadData()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  async function loadData() {
    const [eventRes, incidentRes] = await Promise.all([
      supabase
        .from("events")
        .select(`
          id,
          title,
          event_date,
          start_time,
          end_time,
          location_name,
          address,
          event_type,
          notes,
          status,
          created_at
        `)
        .order("event_date", { ascending: true }),

      supabase
        .from("incidents")
        .select(`
          id,
          title,
          incident_number,
          type,
          status,
          created_at,
          staging_name,
          staging_address
        `)
        .order("created_at", { ascending: false }),
    ]);

    setEvents((eventRes.data as EventRow[]) ?? []);
    setIncidents((incidentRes.data as IncidentRow[]) ?? []);
  }

  async function createEvent() {
    if (!title.trim()) {
      alert("Event title is required.");
      return;
    }

    if (!eventDate) {
      alert("Event date is required.");
      return;
    }

    setCreating(true);

    const { data: authData } = await supabase.auth.getUser();
    const email = authData.user?.email || getCurrentTestEmail();

    const { data: user } = await supabase
      .from("users")
      .select("id")
      .ilike("email", email)
      .maybeSingle();

    const { error } = await supabase.from("events").insert({
      title: title.trim(),
      event_date: eventDate,
      start_time: startTime || null,
      end_time: endTime || null,
      location_name: locationName.trim() || null,
      address: address.trim() || null,
      event_type: eventType,
      notes: notes.trim() || null,
      status: "Scheduled",
      created_by: user?.id ?? null,
    });

    setCreating(false);

    if (error) {
      alert(error.message);
      return;
    }

    setTitle("");
    setEventDate("");
    setStartTime("");
    setEndTime("");
    setLocationName("");
    setAddress("");
    setEventType("Non-Emergency Event");
    setNotes("");
    setShowCreate(false);
    setSelectedDate(eventDate);
    await loadData();
  }

  function toDateKey(date: Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function incidentDateKey(createdAt: string) {
    return toDateKey(new Date(createdAt));
  }

  function formatDate(date: string) {
    return new Date(`${date}T00:00:00`).toLocaleDateString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatTime(time: string | null) {
    if (!time) return null;

    const [hour, minute] = time.split(":");
    const d = new Date();
    d.setHours(Number(hour), Number(minute), 0, 0);

    return d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function monthLabel(date: Date) {
    return date.toLocaleDateString([], {
      month: "long",
      year: "numeric",
    });
  }

  function changeMonth(amount: number) {
    setCurrentMonth((prev) => {
      const next = new Date(prev);
      next.setMonth(next.getMonth() + amount);
      return next;
    });
  }

  const calendarItems = useMemo<CalendarItem[]>(() => {
    const eventItems: CalendarItem[] = events
      .filter((event) => event.status !== "Cancelled")
      .map((event) => ({
        id: event.id,
        kind: "event",
        title: event.title,
        date: event.event_date,
        subtitle: event.location_name || event.address || event.event_type || "Event",
        status: event.status || "Scheduled",
      }));

    const incidentItems: CalendarItem[] = incidents.map((incident) => ({
      id: incident.id,
      kind: "incident",
      title: incident.title,
      date: incidentDateKey(incident.created_at),
      subtitle: `${incident.incident_number} • ${incident.type}`,
      status: incident.status,
      href: `/incidents/${incident.id}`,
    }));

    return [...eventItems, ...incidentItems];
  }, [events, incidents]);

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const start = new Date(firstDay);
    start.setDate(firstDay.getDate() - firstDay.getDay());

    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [currentMonth]);

  const itemsByDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();

    for (const item of calendarItems) {
      const existing = map.get(item.date) ?? [];
      existing.push(item);
      map.set(item.date, existing);
    }

    return map;
  }, [calendarItems]);

  const selectedItems = itemsByDate.get(selectedDate) ?? [];

  const upcomingEvents = useMemo(() => {
    const today = toDateKey(new Date());

    return events
      .filter((event) => event.event_date >= today && event.status !== "Cancelled")
      .slice()
      .sort((a, b) => a.event_date.localeCompare(b.event_date));
  }, [events]);

  return (
    <main className="min-h-screen bg-black px-4 py-5 pb-28 text-white sm:p-6 sm:pb-28">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-gray-500">Matzil SAR</p>
            <h1 className="text-3xl font-bold">Calendar</h1>
          </div>

          <Link
            href="/"
            className="rounded border border-gray-800 bg-gray-900 px-4 py-2 text-sm"
          >
            Dashboard
          </Link>
        </div>

        <button
          onClick={() => setShowCreate((v) => !v)}
          className="w-full rounded-xl bg-red-600 px-4 py-3 font-medium sm:w-auto"
        >
          {showCreate ? "Close Event Form" : "Create Event"}
        </button>

        {showCreate && (
          <section className="space-y-3 rounded-xl bg-gray-900 p-5">
            <div className="text-xl font-semibold">Create Non-Emergency Event</div>

            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event title"
              className="w-full rounded bg-black px-4 py-3"
            />

            <div className="grid gap-3 sm:grid-cols-3">
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full rounded bg-black px-4 py-3"
              />

              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded bg-black px-4 py-3"
              />

              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded bg-black px-4 py-3"
              />
            </div>

            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              className="w-full rounded bg-black px-4 py-3"
            >
              <option>Non-Emergency Event</option>
              <option>Training</option>
              <option>Standby Coverage</option>
              <option>Community Event</option>
              <option>Meeting</option>
            </select>

            <input
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              placeholder="Location name"
              className="w-full rounded bg-black px-4 py-3"
            />

            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Address"
              className="w-full rounded bg-black px-4 py-3"
            />

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes"
              rows={4}
              className="w-full rounded bg-black px-4 py-3"
            />

            <button
              onClick={() => void createEvent()}
              disabled={creating}
              className="w-full rounded bg-red-600 px-4 py-3 font-medium disabled:opacity-60"
            >
              {creating ? "Creating..." : "Create Event"}
            </button>
          </section>
        )}

        <section className="rounded-xl bg-gray-900 p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <button
              onClick={() => changeMonth(-1)}
              className="rounded bg-black px-3 py-2 text-sm"
            >
              ◀
            </button>

            <div className="text-lg font-semibold">{monthLabel(currentMonth)}</div>

            <button
              onClick={() => changeMonth(1)}
              className="rounded bg-black px-3 py-2 text-sm"
            >
              ▶
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="py-1">
                {day}
              </div>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1">
            {calendarDays.map((day) => {
              const key = toDateKey(day);
              const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
              const isSelected = key === selectedDate;
              const items = itemsByDate.get(key) ?? [];

              return (
                <button
                  key={key}
                  onClick={() => setSelectedDate(key)}
                  className={`min-h-[72px] rounded-lg border p-1 text-left ${
                    isSelected
                      ? "border-red-500 bg-red-950/40"
                      : "border-gray-800 bg-black/30"
                  } ${isCurrentMonth ? "opacity-100" : "opacity-40"}`}
                >
                  <div className="text-xs text-gray-300">{day.getDate()}</div>

                  <div className="mt-1 flex flex-wrap gap-1">
                    {items.slice(0, 3).map((item) => (
                      <span
                        key={`${item.kind}-${item.id}`}
                        className={`h-2 w-2 rounded-full ${
                          item.kind === "incident" ? "bg-red-500" : "bg-blue-400"
                        }`}
                      />
                    ))}

                    {items.length > 3 && (
                      <span className="text-[10px] text-gray-400">
                        +{items.length - 3}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl bg-gray-900 p-4">
          <div className="mb-3">
            <div className="text-lg font-semibold">
              {formatDate(selectedDate)}
            </div>
            <div className="text-sm text-gray-400">
              Events and incidents for this date
            </div>
          </div>

          {selectedItems.length === 0 ? (
            <div className="rounded-lg bg-black/30 p-4 text-gray-400">
              Nothing scheduled or logged.
            </div>
          ) : (
            <div className="space-y-2">
              {selectedItems.map((item) => {
                const content = (
                  <div className="rounded-lg bg-black/30 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{item.title}</div>
                        <div className="mt-1 text-sm text-gray-400">
                          {item.subtitle}
                        </div>
                      </div>

                      <span
                        className={`rounded px-2 py-1 text-xs ${
                          item.kind === "incident"
                            ? "bg-red-950 text-red-200"
                            : "bg-blue-950 text-blue-200"
                        }`}
                      >
                        {item.kind}
                      </span>
                    </div>

                    <div className="mt-2 text-xs text-gray-500">
                      Status: {item.status}
                    </div>
                  </div>
                );

                return item.href ? (
                  <Link key={`${item.kind}-${item.id}`} href={item.href}>
                    {content}
                  </Link>
                ) : (
                  <div key={`${item.kind}-${item.id}`}>{content}</div>
                );
              })}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <button
            onClick={() => setUpcomingOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-xl bg-gray-900 px-4 py-3 text-left"
          >
            <div>
              <div className="text-lg font-semibold">Upcoming Events</div>
              <div className="text-sm text-gray-500">
                {upcomingEvents.length} upcoming
              </div>
            </div>

            <div className="text-gray-400">{upcomingOpen ? "▲" : "▼"}</div>
          </button>

          {upcomingOpen && (
            <div className="space-y-3">
              {upcomingEvents.length === 0 ? (
                <div className="rounded-xl bg-gray-900 p-5 text-gray-400">
                  No upcoming events.
                </div>
              ) : (
                upcomingEvents.map((event) => (
                  <div key={event.id} className="rounded-xl bg-gray-900 p-4">
                    <div className="break-words text-lg font-semibold">
                      {event.title}
                    </div>

                    <div className="mt-1 text-sm text-gray-400">
                      {event.event_type || "Event"} • {event.status || "Scheduled"}
                    </div>

                    <div className="mt-2 text-sm text-gray-300">
                      {formatDate(event.event_date)}
                      {formatTime(event.start_time)
                        ? ` • ${formatTime(event.start_time)}`
                        : ""}
                      {formatTime(event.end_time)
                        ? ` - ${formatTime(event.end_time)}`
                        : ""}
                    </div>

                    {(event.location_name || event.address) && (
                      <div className="mt-2 text-sm text-gray-400">
                        {event.location_name || event.address}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}