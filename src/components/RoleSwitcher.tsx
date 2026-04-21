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
    <div className="flex items-center gap-2 text-sm">
      <span className="text-gray-400">Role</span>
      <select
        value={role}
        onChange={(e) => onChangeRole(e.target.value as UserRole)}
        className="rounded border border-gray-700 bg-black px-2 py-1 text-white"
      >
        <option value="Member">Member</option>
        <option value="SAR Manager">SAR Manager</option>
        <option value="Global Admin">Global Admin</option>
      </select>
    </div>
  );
}