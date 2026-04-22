export type UserRole =
  | "Member"
  | "Dispatcher"
  | "SAR Manager"
  | "Global Admin";

export const TEST_USERS: Record<UserRole, string> = {
  Member: "member2@matzilsar.org",
  Dispatcher: "dispatcher@matzilsar.org",
  "SAR Manager": "manager@matzilsar.org",
  "Global Admin": "admin@matzilsar.org",
};

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
  return TEST_USERS[getStoredRole()];
}