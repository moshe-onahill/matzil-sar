"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Home() {
  useEffect(() => {
    if ("Notification" in window) {
      Notification.requestPermission();
    }
  }, []);

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-10">
          <p className="text-sm text-gray-500 mb-2">Matzil SAR</p>
          <h1 className="text-4xl font-bold">Member Operations Portal</h1>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Link href="/incidents" className="p-6 bg-red-900 rounded-xl">
            Incidents
          </Link>

          <Link href="/dashboard" className="p-6 bg-gray-800 rounded-xl">
            Dashboard
          </Link>

          <Link href="/create-incident" className="p-6 bg-gray-800 rounded-xl">
            Create Incident
          </Link>
        </div>
      </div>
    </main>
  );
}