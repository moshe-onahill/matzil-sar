"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function login() {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      return;
    }

    window.location.href = "/settings";
  }

  async function loginWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/settings`,
      },
    });
  }

  async function resetPassword() {
    if (!email) {
      alert("Enter email first");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "http://localhost:3000/login",
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Password reset email sent");
  }

  return (
    <main className="min-h-screen bg-black flex items-center justify-center text-white">
      <div className="w-full max-w-sm space-y-4 rounded-xl bg-gray-900 p-6">
        <h1 className="text-2xl font-bold">Login</h1>

        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full rounded bg-black px-4 py-3"
        />

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full rounded bg-black px-4 py-3"
        />

        <button
          onClick={login}
          className="w-full rounded bg-red-600 px-4 py-3"
        >
          Login
        </button>

        <button
          onClick={loginWithGoogle}
          className="w-full rounded bg-white text-black px-4 py-3"
        >
          Sign in with Google
        </button>

        <button
          onClick={resetPassword}
          className="w-full text-sm text-gray-400 underline"
        >
          Forgot password?
        </button>
      </div>
    </main>
  );
}