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

/**
 * Returns the role set by AuthGate from the DB.
 */
export function getStoredRole(): UserRole {
  if (typeof window === "undefined") return "Member";

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
