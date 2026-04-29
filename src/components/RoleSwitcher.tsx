"use client";

import { useEffect, useState } from "react";
import { getStoredRole, setStoredRole, UserRole } from "@/lib/dev-user";

export default function RoleSwitcher() {
  const [role, setRole] = useState<UserRole>("Member");

  useEffect(() => {
    setRole(getStoredRole());
  }, []);

  function updateRole(newRole: UserRole) {
    setStoredRole(newRole);
    setRole(newRole);
    window.location.reload();
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400">Role:</span>

      <select
        value={role}
        onChange={(e) => updateRole(e.target.value as UserRole)}
        className="rounded bg-gray-800 px-2 py-1 text-xs"
      >
        <option value="Member">Member</option>
        <option value="Dispatcher">Dispatcher</option>
        <option value="SAR Manager">SAR Manager</option>
        <option value="Global Admin">Global Admin</option>
      </select>
    </div>
  );
}