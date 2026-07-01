"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getStoredRole } from "@/lib/dev-user";
import V1Shell from "./V1Shell";
import PushPermission from "./PushPermission";
import SetupScreen from "./SetupScreen";
import NotificationListener from "./NotificationListener";
import SwipeNav from "./SwipeNav";
import NavContentWrapper from "./NavContentWrapper";
import AppBottomNav from "./AppBottomNav";
import PrivacyGate from "./PrivacyGate";

const V2_ROLES = ["Dispatcher", "SAR Manager", "Global Admin"];

function isV2Session(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem("v2-mode") === "1" && V2_ROLES.includes(getStoredRole());
}

const PUBLIC_PATHS = ["/login", "/reset-password"];

export default function V1Gate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [v2] = useState(isV2Session);
  const [setupDone, setSetupDone] = useState(true); // start true to avoid flash
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    import("@capacitor/core").then(({ Capacitor }) => {
      if (!Capacitor.isNativePlatform()) return;
      setIsNative(true);
      setSetupDone(localStorage.getItem("setup-complete") === "1");
    });
  }, []);

  if (PUBLIC_PATHS.includes(pathname)) return <>{children}</>;

  if (v2) {
    return (
      <>
        <PushPermission />
        <NotificationListener />
        <SwipeNav>
          <NavContentWrapper>{children}</NavContentWrapper>
        </SwipeNav>
        <AppBottomNav />
        <PrivacyGate />
      </>
    );
  }

  // Show setup screen on native if not yet completed
  if (isNative && !setupDone) {
    return <SetupScreen onComplete={() => setSetupDone(true)} />;
  }

  return <V1Shell />;
}
