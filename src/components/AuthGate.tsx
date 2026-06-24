"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { setRealRole, UserRole } from "@/lib/dev-user";

const ROLE_PRIORITY: UserRole[] = ["Member", "Dispatcher", "SAR Manager", "Global Admin"];

function highestRole(names: string[]): UserRole {
  let best: UserRole = "Member";
  for (const name of names) {
    if (ROLE_PRIORITY.indexOf(name as UserRole) > ROLE_PRIORITY.indexOf(best)) {
      best = name as UserRole;
    }
  }
  return best;
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [denied, setDenied] = useState(false);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (pathname === "/login" || pathname === "/reset-password") {
      setChecking(false);
      return;
    }
    // If user chose "don't remember me", sign out when the browser session ends
    if (typeof window !== "undefined" &&
        localStorage.getItem("session-temporary") === "1" &&
        !sessionStorage.getItem("session-active")) {
      void supabase.auth.signOut().then(() => { window.location.href = "/login"; });
      return;
    }
    if (typeof window !== "undefined") {
      sessionStorage.setItem("session-active", "1");
    }
    void checkRoster();
  }, [pathname]);

  async function checkRoster() {
    setChecking(true);
    setDenied(false);

    const { data: { user } } = await supabase.auth.getUser();

    // Middleware already handles the redirect; if we reach here without a user
    // just wait (edge case during session hydration).
    if (!user?.email) {
      setChecking(false);
      return;
    }

    const email = user.email.toLowerCase().trim();
    setAuthEmail(email);
    window.localStorage.setItem("auth-email", email);

    const { data: rosterUser, error } = await supabase
      .from("users")
      .select("id, is_active, user_roles ( roles ( name ) )")
      .ilike("email", email)
      .maybeSingle();

    if (error) {
      setReason(`Roster lookup error: ${error.message}`);
      setDenied(true);
      setChecking(false);
      return;
    }

    if (!rosterUser) {
      setReason("Your email is not on the approved roster. Contact an admin.");
      setDenied(true);
      setChecking(false);
      return;
    }

    if (rosterUser.is_active === false) {
      setReason("Your account has been deactivated. Contact an admin.");
      setDenied(true);
      setChecking(false);
      return;
    }

    const roleNames = (rosterUser.user_roles ?? []).flatMap((ur: any) => {
      const r = ur.roles;
      if (Array.isArray(r)) return r.map((x: any) => x.name);
      if (r?.name) return [r.name];
      return [];
    });
    setRealRole(highestRole(roleNames));
    window.localStorage.removeItem("dev-role");

    setChecking(false);
  }

  async function logout() {
    window.localStorage.removeItem("auth-email");
    window.localStorage.removeItem("real-role");
    window.localStorage.removeItem("dev-role");
    window.localStorage.removeItem("session-temporary");
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-700 border-t-red-500" />
          <div className="text-sm text-gray-500">Verifying access…</div>
        </div>
      </main>
    );
  }

  if (denied) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black p-6 text-white">
        <div className="w-full max-w-sm rounded-2xl bg-gray-900 p-6 space-y-4">
          <div className="text-xl font-bold text-red-400">Access Denied</div>
          <div className="text-sm text-gray-300">{reason}</div>
          {authEmail && (
            <div className="rounded-lg bg-black/40 px-3 py-2 text-sm text-gray-400">
              Signed in as <span className="text-white">{authEmail}</span>
            </div>
          )}
          <button
            onClick={() => void logout()}
            className="w-full rounded-xl bg-red-600 px-4 py-3 font-medium"
          >
            Sign Out
          </button>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
