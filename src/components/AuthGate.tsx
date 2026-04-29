"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const publicRoutes = ["/login"];

  useEffect(() => {
    if (publicRoutes.includes(pathname)) {
      setAllowed(true);
      setChecking(false);
      return;
    }

    void checkAuth();
  }, [pathname]);

  async function checkAuth() {
    setChecking(true);

    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData.user;

    if (!authUser?.email) {
      window.location.href = "/login";
      return;
    }

    const email = authUser.email.toLowerCase().trim();
    setAuthEmail(email);
    window.localStorage.setItem("auth-email", email);

    const { data: rosterUser, error: rosterError } = await supabase
      .from("users")
      .select("id, email, is_active")
      .ilike("email", email)
      .maybeSingle();

    if (rosterError) {
      setReason(`Roster lookup error: ${rosterError.message}`);
      setAllowed(false);
      setChecking(false);
      return;
    }

    if (!rosterUser) {
      setReason("No matching roster user found.");
      setAllowed(false);
      setChecking(false);
      return;
    }

    if (rosterUser.is_active === false) {
      setReason("Roster user exists but is inactive.");
      setAllowed(false);
      setChecking(false);
      return;
    }

    setAllowed(true);
    setChecking(false);
  }

  async function logout() {
    window.localStorage.removeItem("auth-email");
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (checking) {
    return (
      <main className="min-h-screen bg-black p-6 text-white">
        Checking access...
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="min-h-screen bg-black p-6 text-white">
        <div className="mx-auto max-w-xl rounded-xl bg-gray-900 p-6">
          <div className="text-xl font-semibold text-red-300">
            Account Not Approved
          </div>

          <div className="mt-2 text-gray-300">
            Your account is not approved or is inactive. Contact an admin.
          </div>

          {authEmail && (
            <div className="mt-4 rounded bg-black/40 p-3 text-sm text-gray-300">
              Logged in as: <span className="text-white">{authEmail}</span>
            </div>
          )}

          {reason && (
            <div className="mt-3 rounded bg-black/40 p-3 text-sm text-yellow-300">
              Reason: {reason}
            </div>
          )}

          <button
            onClick={() => void logout()}
            className="mt-5 w-full rounded bg-red-600 px-4 py-3 font-medium"
          >
            Log Out
          </button>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}