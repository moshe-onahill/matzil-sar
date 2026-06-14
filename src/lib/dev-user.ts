export type UserRole =
  | "Member"
  | "Dispatcher"
  | "SAR Manager"
  | "Global Admin";

/** Called by AuthGate after resolving role from DB */
export function setRealRole(role: UserRole) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("real-role", role);
}

/** Called by the 5-tap dev panel to temporarily override the role */
export function setStoredRole(role: UserRole) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("dev-role", role);
}

/**
 * Returns the effective role:
 * 1. dev-role override (set by 5-tap panel) if present
 * 2. real-role from DB (set by AuthGate)
 * 3. fallback: "Member"
 */
export function getStoredRole(): UserRole {
  if (typeof window === "undefined") return "Member";

  const override = window.localStorage.getItem("dev-role");
  if (
    override === "Member" ||
    override === "Dispatcher" ||
    override === "SAR Manager" ||
    override === "Global Admin"
  ) {
    return override;
  }

  const real = window.localStorage.getItem("real-role");
  if (
    real === "Member" ||
    real === "Dispatcher" ||
    real === "SAR Manager" ||
    real === "Global Admin"
  ) {
    return real;
  }

  return "Member";
}

/** Email of the signed-in user — set by AuthGate from Supabase auth session */
export function getCurrentTestEmail(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("auth-email") || "";
}
