"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import RoleSwitcher from "@/components/RoleSwitcher";
import { getStoredRole, UserRole } from "@/lib/dev-user";

type UserRow = {
  id: string;
  full_name: string;
  call_sign: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  is_invited: boolean;
  user_roles: {
    roles: {
      name: string;
    }[] | {
      name: string;
    } | null;
  }[];
  user_units: {
    units: {
      name: string;
    }[] | {
      name: string;
    } | null;
  }[];
};

export default function RosterPage() {
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>("Member");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [unitFilter, setUnitFilter] = useState("All");

  useEffect(() => {
    setCurrentUserRole(getStoredRole());
    void loadRoster();

    const channel = supabase
      .channel("roster-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "users" },
        () => void loadRoster()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_roles" },
        () => void loadRoster()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_units" },
        () => void loadRoster()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  async function loadRoster() {
    const role = getStoredRole();
    setCurrentUserRole(role);

    let query = supabase
      .from("users")
      .select(`
        id,
        full_name,
        call_sign,
        email,
        phone,
        is_active,
        is_invited,
        user_roles (
          roles (
            name
          )
        ),
        user_units (
          units (
            name
          )
        )
      `)
      .order("full_name", { ascending: true });

    if (role !== "Global Admin") {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;

    if (error) {
      console.log("Roster load failed", error);
      return;
    }

    setUsers((data as UserRow[]) ?? []);
  }

  function extractNames(items: any[], key: "roles" | "units") {
    return items.flatMap((item) => {
      const value = item?.[key];
      if (Array.isArray(value)) {
        return value.map((x) => x?.name).filter(Boolean);
      }
      if (value?.name) {
        return [value.name];
      }
      return [];
    });
  }

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const roleNames = extractNames(user.user_roles ?? [], "roles");
      const unitNames = extractNames(user.user_units ?? [], "units");

      const matchesSearch =
        user.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        user.call_sign?.toLowerCase().includes(search.toLowerCase());

      const matchesRole =
        roleFilter === "All" || roleNames.includes(roleFilter);

      const matchesUnit =
        unitFilter === "All" || unitNames.includes(unitFilter);

      return matchesSearch && matchesRole && matchesUnit;
    });
  }, [users, search, roleFilter, unitFilter]);

  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Matzil SAR</p>
            <h1 className="text-3xl font-bold">Roster</h1>
          </div>

          <div className="flex items-center gap-3">
            <RoleSwitcher />

            {currentUserRole === "Global Admin" && (
              <Link
                href="/roster/new"
                className="rounded bg-red-600 px-4 py-2"
              >
                + Add User
              </Link>
            )}

            <Link
              href="/"
              className="rounded border border-gray-800 bg-gray-900 px-4 py-2"
            >
              Dashboard
            </Link>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or call sign"
            className="rounded bg-gray-900 px-3 py-2"
          />

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded bg-gray-900 px-3 py-2"
          >
            <option>All</option>
            <option>Member</option>
            <option>Dispatcher</option>
            <option>SAR Manager</option>
            <option>Global Admin</option>
          </select>

          <select
            value={unitFilter}
            onChange={(e) => setUnitFilter(e.target.value)}
            className="rounded bg-gray-900 px-3 py-2"
          >
            <option>All</option>
            <option>Water</option>
            <option>Wilderness</option>
            <option>MRU</option>
            <option>Support</option>
          </select>
        </div>

        <div className="space-y-3">
          {filteredUsers.length === 0 && (
            <div className="rounded-xl bg-gray-900 p-5 text-gray-400">
              No users found.
            </div>
          )}

          {filteredUsers.map((user) => {
            const unitNames = extractNames(user.user_units ?? [], "units");

            return (
              <Link
                key={user.id}
                href={`/roster/${user.id}`}
                className="block rounded-xl bg-gray-900 p-5 transition hover:bg-gray-800"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xl font-medium">{user.full_name}</div>
                    <div className="mt-1 text-sm text-gray-400">
                      Call Sign: {user.call_sign}
                    </div>
                  </div>

                  <div className="text-right text-sm">
                    <div className="text-gray-400">Units</div>
                    <div>{unitNames.length ? unitNames.join(", ") : "None"}</div>
                    {!user.is_active && currentUserRole === "Global Admin" && (
                      <div className="mt-1 text-yellow-400">Deactivated</div>
                    )}
                    {user.is_invited && (
                      <div className="mt-1 text-blue-400">Invited</div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}