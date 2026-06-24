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
 * Returns the effective role.
 * In V2 mode a dev-role override is honoured; otherwise always uses the real DB role.
 */
export function getStoredRole(): UserRole {
  if (typeof window === "undefined") return "Member";

  const isV2 = sessionStorage.getItem("v2-mode") === "1";
  if (isV2) {
    const override = window.localStorage.getItem("dev-role");
    if (
      override === "Member" ||
      override === "Dispatcher" ||
      override === "SAR Manager" ||
      override === "Global Admin"
    ) {
      return override;
    }
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
