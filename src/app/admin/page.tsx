"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getStoredRole } from "@/lib/dev-user";

const tiles = [
  {
    href: "/admin/roster",
    label: "Roster",
    desc: "Manage members — edit details, assign roles, invite and deactivate",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
    color: "text-blue-400 bg-blue-600/10 border-blue-800/40",
  },
  {
    href: "/admin/units",
    label: "Responding Units",
    desc: "Live GPS, ETA, and task assignments for all responding units",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />
      </svg>
    ),
    color: "text-red-400 bg-red-600/10 border-red-800/40",
  },
  {
    href: "/admin/incidents",
    label: "Incident Coordination",
    desc: "Create and manage tasks, assign leads, and track field units",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    color: "text-orange-400 bg-orange-600/10 border-orange-800/40",
  },
  {
    href: "/admin/events",
    label: "Events",
    desc: "Schedule and manage training sessions and team events",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
    color: "text-green-400 bg-green-600/10 border-green-800/40",
  },
];

export default function AdminConsolePage() {
  const [role, setRole] = useState("");

  useEffect(() => {
    const r = getStoredRole();
    setRole(r);
    if (r !== "SAR Manager" && r !== "Global Admin") {
      window.location.href = "/";
    }
  }, []);

  return (
    <main className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-50">Overview</h1>
        <p className="mt-1 text-sm text-zinc-500">{role}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {tiles.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="group rounded-xl border border-zinc-800 bg-zinc-900 p-5 transition hover:border-zinc-700 hover:bg-zinc-800/80"
          >
            <div className={`inline-flex rounded-lg border p-2.5 ${t.color}`}>
              {t.icon}
            </div>
            <div className="mt-3 font-semibold text-zinc-100 group-hover:text-white">{t.label}</div>
            <div className="mt-1 text-sm leading-relaxed text-zinc-500">{t.desc}</div>
          </Link>
        ))}
      </div>
    </main>
  );
}
