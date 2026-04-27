"use client";

import Link from "next/link";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import RoleSwitcher from "@/components/RoleSwitcher";
import { getCurrentTestEmail, getStoredRole } from "@/lib/dev-user";

export default function AnnouncementsPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);

  async function postAnnouncement() {
    const role = getStoredRole();

    if (role !== "SAR Manager" && role !== "Global Admin") {
      alert("You do not have permission to post announcements.");
      return;
    }

    if (!title.trim()) {
      alert("Title is required.");
      return;
    }

    setPosting(true);

    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("email", getCurrentTestEmail())
      .single();

    const { error } = await supabase.from("announcements").insert({
      title: title.trim(),
      body: body.trim() || null,
      created_by: user?.id ?? null,
    });

    setPosting(false);

    if (error) {
      alert(error.message);
      return;
    }

    setTitle("");
    setBody("");
    alert("Announcement posted");
    window.location.href = "/";
  }

  return (
    <main className="min-h-screen bg-black px-4 py-5 pb-28 text-white sm:p-6 sm:pb-28">
      <div className="mx-auto max-w-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            href="/"
            className="rounded border border-gray-800 bg-gray-900 px-4 py-2 text-sm"
          >
            Back
          </Link>

          <RoleSwitcher />
        </div>

        <div>
          <p className="text-sm text-gray-500">Matzil SAR</p>
          <h1 className="text-3xl font-bold">Post Announcement</h1>
        </div>

        <div className="space-y-3 rounded-xl bg-gray-900 p-5">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Announcement title"
            className="w-full rounded bg-black px-4 py-3"
          />

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Message"
            rows={5}
            className="w-full rounded bg-black px-4 py-3"
          />

          <button
            onClick={() => void postAnnouncement()}
            disabled={posting}
            className="w-full rounded bg-red-600 px-4 py-3 font-medium disabled:opacity-60"
          >
            {posting ? "Posting..." : "Post Announcement"}
          </button>
        </div>
      </div>
    </main>
  );
}