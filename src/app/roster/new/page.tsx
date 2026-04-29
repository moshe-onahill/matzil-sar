"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import RoleSwitcher from "@/components/RoleSwitcher";

type Item = { id: string; name: string };

export default function NewUserPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [callSign, setCallSign] = useState("");
  const [email, setEmail] = useState("");

  const [roles, setRoles] = useState<Item[]>([]);
  const [units, setUnits] = useState<Item[]>([]);

  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    const r = await supabase.from("roles").select("*").order("name");
    const u = await supabase.from("units").select("*").order("name");

    setRoles(r.data ?? []);
    setUnits(u.data ?? []);
  }

  function toggle(list: string[], id: string, set: any) {
    if (list.includes(id)) {
      set(list.filter((x) => x !== id));
    } else {
      set([...list, id]);
    }
  }

  async function createUser() {
    if (!fullName.trim() || !callSign.trim() || !email.trim()) {
      alert("Name, call sign, and email required");
      return;
    }

    const { data, error } = await supabase
      .from("users")
      .insert({
        full_name: fullName.trim(),
        call_sign: callSign.trim(),
        email: email.trim().toLowerCase(),
        is_active: true,
        is_invited: true,
      })
      .select()
      .single();

    if (error || !data) {
      alert(error?.message);
      return;
    }

    const userId = data.id;

    if (selectedRoles.length) {
      await supabase.from("user_roles").insert(
        selectedRoles.map((r) => ({
          user_id: userId,
          role_id: r,
        }))
      );
    }

    if (selectedUnits.length) {
      await supabase.from("user_units").insert(
        selectedUnits.map((u) => ({
          user_id: userId,
          unit_id: u,
        }))
      );
    }

    alert("User created");
    router.push("/roster");
  }

  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto max-w-xl space-y-4">
        <div className="flex justify-between">
          <button
            onClick={() => router.push("/roster")}
            className="rounded bg-gray-800 px-4 py-2"
          >
            Back
          </button>
          <RoleSwitcher />
        </div>

        <div className="rounded-xl bg-gray-900 p-5 space-y-4">
          <div className="text-xl font-bold">Add User</div>

          <input
            placeholder="Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded bg-black px-3 py-2"
          />

          <input
            placeholder="Call Sign"
            value={callSign}
            onChange={(e) => setCallSign(e.target.value)}
            className="w-full rounded bg-black px-3 py-2"
          />

          <input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded bg-black px-3 py-2"
          />

          <div>
            <div className="font-semibold mb-1">Roles</div>
            {roles.map((r) => (
              <label key={r.id} className="flex gap-2">
                <input
                  type="checkbox"
                  checked={selectedRoles.includes(r.id)}
                  onChange={() =>
                    toggle(selectedRoles, r.id, setSelectedRoles)
                  }
                />
                <span>{r.name}</span>
              </label>
            ))}
          </div>

          <div>
            <div className="font-semibold mb-1">Units</div>
            {units.map((u) => (
              <label key={u.id} className="flex gap-2">
                <input
                  type="checkbox"
                  checked={selectedUnits.includes(u.id)}
                  onChange={() =>
                    toggle(selectedUnits, u.id, setSelectedUnits)
                  }
                />
                <span>{u.name}</span>
              </label>
            ))}
          </div>

          <button
            onClick={() => void createUser()}
            className="w-full rounded bg-green-600 py-2"
          >
            Create User
          </button>
        </div>
      </div>
    </main>
  );
}