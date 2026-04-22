"use client";

import Link from "next/link";
import RoleSwitcher from "@/components/RoleSwitcher";

export default function SettingsPage() {
  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Matzil SAR</p>
            <h1 className="text-3xl font-bold">Settings</h1>
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

        <div className="rounded-xl bg-gray-900 p-6">
          <div className="text-lg font-semibold">App Settings</div>
          <div className="mt-2 text-gray-400">
            This page is ready for login, device settings, notifications, and map/API configuration.
          </div>
        </div>
      </div>
    </main>
  );
}