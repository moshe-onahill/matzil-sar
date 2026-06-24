"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { getStoredRole } from "@/lib/dev-user";
import V1Shell from "./V1Shell";
import PushPermission from "./PushPermission";
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
  // Read synchronously on first render — no flash, no useEffect needed
  const [v2] = useState(isV2Session);

  // Pass through on public routes so the login/reset pages render normally
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

  return <V1Shell />;
}
