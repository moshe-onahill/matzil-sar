"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getStoredRole } from "@/lib/dev-user";

export default function AdminConsolePage() {
  const [role, setRole] = useState("");

  useEffect(() => {
    const r = getStoredRole();
    setRole(r);
    if (r !== "SAR Manager" && r !== "Global Admin") {
      window.location.href = "/";
    }
  }, []);

  const tiles = [
    { href: "/admin/roster", label: "Roster", desc: "All members — edit, invite, deactivate", icon: "👥" },
    { href: "/admin/units", label: "Responding Units", desc: "Live view of all responding units", icon: "🚨" },
    { href: "/incidents", label: "Incidents", desc: "Manage active and past incidents", icon: "📋" },
    { href: "/admin/events", label: "Events", desc: "Manage training and events", icon: "📅" },
  ];

  return (
    <main className="min-h-screen bg-black px-4 py-5 pb-28 text-white sm:p-6">
      <div className="mx-auto max-w-4xl space-y-5">
        <div>
          <p className="text-sm text-gray-500">Matzil SAR</p>
          <h1 className="text-3xl font-bold">Admin Console</h1>
          <p className="mt-1 text-sm text-gray-400">{role}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {tiles.map((t) => (
            <Link key={t.href} href={t.href} className="rounded-xl bg-gray-900 p-5 hover:bg-gray-800 transition">
              <div className="text-2xl">{t.icon}</div>
              <div className="mt-2 font-semibold">{t.label}</div>
              <div className="mt-0.5 text-sm text-gray-400">{t.desc}</div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
