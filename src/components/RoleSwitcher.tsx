"use client";

import { useEffect, useState } from "react";
import { UserRole, getStoredRole, setStoredRole } from "@/lib/dev-user";

export default function RoleSwitcher() {
  const [role, setRole] = useState<UserRole>("Member");

  useEffect(() => {
    setRole(getStoredRole());
  }, []);

  function onChangeRole(newRole: UserRole) {
    setStoredRole(newRole);
    setRole(newRole);
    window.location.reload();
  }

  return (
    <div className="flex min-w-0 items-center gap-2 text-sm">
      <span className="shrink-0 text-gray-400">Role</span>

      <select
        value={role}
        onChange={(e) => onChangeRole(e.target.value as UserRole)}
        className="max-w-[170px] rounded border border-gray-700 bg-black px-2 py-2 text-white sm:max-w-none"
      >
        <option value="Member">Member</option>
        <option value="Dispatcher">Dispatcher</option>
        <option value="SAR Manager">SAR Manager</option>
        <option value="Global Admin">Global Admin</option>
      </select>
    </div>
  );
}