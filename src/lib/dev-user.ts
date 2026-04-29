export type UserRole =
  | "Member"
  | "Dispatcher"
  | "SAR Manager"
  | "Global Admin";

export function getStoredRole(): UserRole {
  if (typeof window === "undefined") return "Member";

  const value = window.localStorage.getItem("dev-role");

  if (
    value === "Member" ||
    value === "Dispatcher" ||
    value === "SAR Manager" ||
    value === "Global Admin"
  ) {
    return value;
  }

  return "Member";
}

export function setStoredRole(role: UserRole) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("dev-role", role);
}

export function getCurrentTestEmail(): string {
  if (typeof window === "undefined") return "";

  return (
    window.localStorage.getItem("auth-email") ||
    "briefmoshe@gmail.com"
  );
}