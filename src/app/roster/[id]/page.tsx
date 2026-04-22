"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import RoleSwitcher from "@/components/RoleSwitcher";
import { getStoredRole, UserRole } from "@/lib/dev-user";

type NamedItem = { id: string; name: string };

type UserProfile = {
  id: string;
  full_name: string;
  call_sign: string;
  email: string;
  phone: string | null;
  is_active: boolean | null;
  is_invited: boolean | null;
  user_roles: { roles: NamedItem[] | NamedItem | null }[];
  user_units: { units: NamedItem[] | NamedItem | null }[];
};

type ActivityItem = {
  type: "response" | "update";
  text: string;
  created_at: string;
};

export default function UserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [userId, setUserId] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [currentRole, setCurrentRole] = useState<UserRole>("Member");

  const [editMode, setEditMode] = useState(false);

  const [allRoles, setAllRoles] = useState<NamedItem[]>([]);
  const [allUnits, setAllUnits] = useState<NamedItem[]>([]);

  const [fullName, setFullName] = useState("");
  const [callSign, setCallSign] = useState("");
  const [phone, setPhone] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isInvited, setIsInvited] = useState(false);

  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);

  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [limit, setLimit] = useState(10);

  useEffect(() => {
    async function init() {
      const p = await params;
      setUserId(p.id);
    }
    void init();
  }, [params]);

  useEffect(() => {
    if (!userId) return;

    setCurrentRole(getStoredRole());
    void loadUser();
    void loadLookups();
    void loadActivity(limit);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    void loadActivity(limit);
  }, [limit, userId]);

  async function loadLookups() {
    const rolesRes = await supabase.from("roles").select("id,name").order("name");
    const unitsRes = await supabase.from("units").select("id,name").order("name");

    setAllRoles((rolesRes.data as NamedItem[]) ?? []);
    setAllUnits((unitsRes.data as NamedItem[]) ?? []);
  }

  async function loadUser() {
    const { data, error } = await supabase
      .from("users")
      .select(`
        *,
        user_roles ( roles ( id, name ) ),
        user_units ( units ( id, name ) )
      `)
      .eq("id", userId)
      .single();

    if (error || !data) {
      console.log("User load failed", error);
      return;
    }

    const u = data as UserProfile;

    setUser(u);

    setFullName(u.full_name ?? "");
    setCallSign(u.call_sign ?? "");
    setPhone(u.phone ?? "");
    setIsActive(u.is_active !== false);
    setIsInvited(u.is_invited === true);

    setSelectedRoles(extractIds(u.user_roles, "roles"));
    setSelectedUnits(extractIds(u.user_units, "units"));
  }

  async function loadActivity(limitCount: number) {
    if (!userId) return;

    const responsesRes = await supabase
      .from("incident_responses")
      .select("response_type, responded_at")
      .eq("user_id", userId)
      .order("responded_at", { ascending: false })
      .limit(limitCount);

    const updatesRes = await supabase
      .from("incident_updates")
      .select("title, created_at")
      .eq("created_by", userId)
      .order("created_at", { ascending: false })
      .limit(limitCount);

    const combined: ActivityItem[] = [
      ...((responsesRes.data ?? []).map((r) => ({
        type: "response" as const,
        text: `Responded: ${r.response_type}`,
        created_at: r.responded_at,
      })) ?? []),
      ...((updatesRes.data ?? []).map((u) => ({
        type: "update" as const,
        text: `Update: ${u.title}`,
        created_at: u.created_at,
      })) ?? []),
    ];

    combined.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    setActivity(combined);
  }

  function extractIds(items: any[], key: "roles" | "units") {
    return items.flatMap((item) => {
      const value = item?.[key];
      if (Array.isArray(value)) return value.map((x) => x.id);
      if (value?.id) return [value.id];
      return [];
    });
  }

  function extractNames(items: any[], key: "roles" | "units") {
    return items.flatMap((item) => {
      const value = item?.[key];
      if (Array.isArray(value)) return value.map((x) => x.name);
      if (value?.name) return [value.name];
      return [];
    });
  }

  function toggle(list: string[], id: string, set: React.Dispatch<React.SetStateAction<string[]>>) {
    if (list.includes(id)) {
      set(list.filter((x) => x !== id));
    } else {
      set([...list, id]);
    }
  }

  async function saveUser() {
    if (!user) return;

    if (!fullName.trim()) {
      alert("Full name is required.");
      return;
    }

    if (!callSign.trim()) {
      alert("Call sign is required.");
      return;
    }

    const duplicateCallSign = await supabase
      .from("users")
      .select("id")
      .eq("call_sign", callSign.trim())
      .neq("id", user.id);

    if ((duplicateCallSign.data ?? []).length > 0) {
      alert("Call sign must be unique.");
      return;
    }

    const { error } = await supabase
      .from("users")
      .update({
        full_name: fullName.trim(),
        call_sign: callSign.trim(),
        phone: phone.trim() || null,
        is_active: isActive,
        is_invited: isInvited,
      })
      .eq("id", user.id);

    if (error) {
      alert(error.message);
      return;
    }

    await supabase.from("user_roles").delete().eq("user_id", user.id);
    await supabase.from("user_units").delete().eq("user_id", user.id);

    if (selectedRoles.length) {
      const rolesInsert = await supabase.from("user_roles").insert(
        selectedRoles.map((r) => ({
          user_id: user.id,
          role_id: r,
        }))
      );

      if (rolesInsert.error) {
        alert(rolesInsert.error.message);
        return;
      }
    }

    if (selectedUnits.length) {
      const unitsInsert = await supabase.from("user_units").insert(
        selectedUnits.map((u) => ({
          user_id: user.id,
          unit_id: u,
        }))
      );

      if (unitsInsert.error) {
        alert(unitsInsert.error.message);
        return;
      }
    }

    alert("Saved");
    setEditMode(false);
    await loadUser();
  }

  async function deactivate() {
    if (!user) return;

    if (!window.confirm("Deactivate user?")) return;

    const { error } = await supabase
      .from("users")
      .update({ is_active: false })
      .eq("id", user.id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadUser();
  }

  async function reactivate() {
    if (!user) return;

    if (!window.confirm("Reactivate user?")) return;

    const { error } = await supabase
      .from("users")
      .update({ is_active: true })
      .eq("id", user.id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadUser();
  }

  async function deleteUser() {
    if (!user) return;

    if (!window.confirm("DELETE USER permanently?")) return;

    const { error } = await supabase
      .from("users")
      .delete()
      .eq("id", user.id);

    if (error) {
      alert(error.message);
      return;
    }

    window.location.href = "/roster";
  }

  async function resendInvite() {
    alert("Invite resend triggered (hook later)");
  }

  if (!user) {
    return <main className="min-h-screen bg-black p-6 text-white">Loading...</main>;
  }

  const roles = extractNames(user.user_roles, "roles");
  const units = extractNames(user.user_units, "units");

  const isAdmin =
    currentRole === "Global Admin" ||
    currentRole === "SAR Manager" ||
    currentRole === "Dispatcher";

  const isMember = currentRole === "Member";
  const isDeactivated = user.is_active === false;
  const invited = user.is_invited === true;

  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex justify-between">
          <Link href="/roster" className="rounded bg-gray-900 px-4 py-2">
            Back
          </Link>
          <RoleSwitcher />
        </div>

        <div className="rounded-xl bg-gray-900 p-5 space-y-3">
          {!editMode ? (
            <>
              <div className="text-2xl font-bold">{user.full_name}</div>
              <div>Call Sign: {user.call_sign}</div>

              {!isMember && (
                <>
                  <div>Email: {user.email}</div>
                  <div>Phone: {user.phone || "None"}</div>
                </>
              )}

              <div>Roles: {roles.join(", ") || "None"}</div>
              <div>Units: {units.join(", ") || "None"}</div>
            </>
          ) : (
            <>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded bg-black px-3 py-2"
                placeholder="Full Name"
              />
              <input
                value={callSign}
                onChange={(e) => setCallSign(e.target.value)}
                className="w-full rounded bg-black px-3 py-2"
                placeholder="Call Sign"
              />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded bg-black px-3 py-2"
                placeholder="Phone"
              />

              <div>Email: {user.email}</div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <span>Active</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isInvited}
                  onChange={(e) => setIsInvited(e.target.checked)}
                />
                <span>Invited</span>
              </label>

              <div className="space-y-2">
                <div className="font-medium">Roles</div>
                {allRoles.map((r) => (
                  <label key={r.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes(r.id)}
                      onChange={() => toggle(selectedRoles, r.id, setSelectedRoles)}
                    />
                    <span>{r.name}</span>
                  </label>
                ))}
              </div>

              <div className="space-y-2">
                <div className="font-medium">Units</div>
                {allUnits.map((u) => (
                  <label key={u.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedUnits.includes(u.id)}
                      onChange={() => toggle(selectedUnits, u.id, setSelectedUnits)}
                    />
                    <span>{u.name}</span>
                  </label>
                ))}
              </div>
            </>
          )}

          {invited && <div className="text-blue-400">Invited</div>}
          {isDeactivated && <div className="text-yellow-400">Deactivated</div>}

          {isAdmin && (
            <div className="mt-3 flex flex-wrap gap-2">
              {!editMode ? (
                <button
                  onClick={() => setEditMode(true)}
                  className="rounded bg-gray-700 px-4 py-2"
                >
                  Edit
                </button>
              ) : (
                <>
                  <button
                    onClick={() => void saveUser()}
                    className="rounded bg-green-600 px-4 py-2"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setEditMode(false);
                      setFullName(user.full_name ?? "");
                      setCallSign(user.call_sign ?? "");
                      setPhone(user.phone ?? "");
                      setIsActive(user.is_active !== false);
                      setIsInvited(user.is_invited === true);
                      setSelectedRoles(extractIds(user.user_roles, "roles"));
                      setSelectedUnits(extractIds(user.user_units, "units"));
                    }}
                    className="rounded bg-gray-600 px-4 py-2"
                  >
                    Cancel
                  </button>
                </>
              )}

              {isDeactivated ? (
                <button
                  onClick={() => void reactivate()}
                  className="rounded bg-green-700 px-4 py-2"
                >
                  Reactivate
                </button>
              ) : (
                <button
                  onClick={() => void deactivate()}
                  className="rounded bg-red-700 px-4 py-2"
                >
                  Deactivate
                </button>
              )}

              <button
                onClick={() => void deleteUser()}
                className="rounded bg-red-900 px-4 py-2"
              >
                Delete
              </button>

              <button
                onClick={() => void resendInvite()}
                className="rounded bg-blue-600 px-4 py-2"
              >
                Resend Invite
              </button>
            </div>
          )}
        </div>

        <div className="rounded-xl bg-gray-900 p-5">
          <div className="mb-3 text-lg font-semibold">Activity</div>

          {activity.length === 0 && (
            <div className="text-gray-400">No activity</div>
          )}

          <div className="space-y-2">
            {activity.map((a, i) => (
              <div
                key={i}
                className="rounded bg-black/30 px-3 py-2 text-sm"
              >
                <div>{a.text}</div>
                <div className="text-xs text-gray-500">
                  {new Date(a.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => setLimit((l) => l + 10)}
            className="mt-3 rounded bg-gray-700 px-4 py-2"
          >
            Load More
          </button>
        </div>
      </div>
    </main>
  );
}