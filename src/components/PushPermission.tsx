"use client";

import { useEffect } from "react";

export default function PushPermission() {
  useEffect(() => {
    void tryRegister();

    // Retry every time the app comes back to foreground (e.g. after manually enabling in Settings)
    let cleanup: (() => void) | undefined;
    import("@capacitor/core").then(({ Capacitor }) => {
      if (!Capacitor.isNativePlatform()) return;
      import("@capacitor/app").then(({ App }) => {
        App.addListener("appStateChange", ({ isActive }) => {
          if (isActive) void tryRegister();
        }).then((handle) => { cleanup = () => handle.remove(); });
      });
    });

    return () => { cleanup?.(); };
  }, []);

  return null;
}

async function tryRegister() {
  const { Capacitor } = await import("@capacitor/core");
  if (!Capacitor.isNativePlatform()) return;
  const { registerFcmToken } = await import("@/lib/push-notifications");
  await registerFcmToken().catch(console.error);
}
