"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import MatzilLogo from "./MatzilLogo";

const KEY = "privacy_accepted_v1";

export default function PrivacyGate() {
  const [show, setShow] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!localStorage.getItem(KEY)) setShow(true);
  }, []);

  function accept() {
    localStorage.setItem(KEY, new Date().toISOString());
    setShow(false);
  }

  if (!mounted || !show) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 space-y-5 shadow-2xl">
        <div className="flex flex-col items-center gap-3">
          <MatzilLogo size={48} />
          <h2 className="text-xl font-bold text-zinc-50 text-center">Privacy & Usage Agreement</h2>
        </div>

        <div className="rounded-xl bg-zinc-800/60 px-4 py-4 text-sm text-zinc-300 space-y-3 max-h-60 overflow-y-auto leading-relaxed">
          <p><strong className="text-zinc-100">Data Collection</strong><br />
            Matzil SAR collects your location, device information, and activity within the app to support search and rescue coordination. Location data is shared with incident commanders and dispatchers during active incidents.
          </p>
          <p><strong className="text-zinc-100">Use of Information</strong><br />
            Your information is used solely for SAR coordination purposes. It is not sold or shared with third parties outside of Matzil SAR operations.
          </p>
          <p><strong className="text-zinc-100">Location Tracking</strong><br />
            When responding to an incident, your GPS location is tracked and visible to authorized team members. Tracking stops when you stand down.
          </p>
          <p><strong className="text-zinc-100">Communications</strong><br />
            You may receive push notifications regarding incidents, deployments, and team updates. You can manage notification preferences in Settings.
          </p>
          <p><strong className="text-zinc-100">Your Rights</strong><br />
            You may request deletion of your data at any time by contacting your unit administrator.
          </p>
        </div>

        <p className="text-xs text-zinc-500 text-center">
          By continuing you confirm you have read and agree to the above.
        </p>

        <button
          onClick={accept}
          className="w-full rounded-xl bg-red-600 py-3 font-semibold text-white hover:bg-red-500 transition"
        >
          I Agree — Continue
        </button>
      </div>
    </div>,
    document.body
  );
}
