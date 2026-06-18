"use client";

import { useEffect, useState } from "react";

export default function NavContentWrapper({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [landscapeMobile, setLandscapeMobile] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem("nav-collapsed") === "1");

    function onStorage(e: StorageEvent) {
      if (e.key === "nav-collapsed") setCollapsed(e.newValue === "1");
    }
    function onNavToggle(e: Event) {
      setCollapsed((e as CustomEvent).detail === "1");
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener("nav-toggle", onNavToggle);

    const mq = window.matchMedia("(orientation: landscape) and (max-width: 1023px)");
    setLandscapeMobile(mq.matches);
    const mqHandler = (e: MediaQueryListEvent) => setLandscapeMobile(e.matches);
    mq.addEventListener("change", mqHandler);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("nav-toggle", onNavToggle);
      mq.removeEventListener("change", mqHandler);
    };
  }, []);

  const hasSidebar = landscapeMobile || true; // sidebar always visible when landscape or lg+
  const pl = collapsed ? "pl-14" : "pl-56";

  return (
    <div className={`min-h-screen w-full overflow-x-hidden transition-[padding] duration-200 ${landscapeMobile ? `pb-0 ${pl}` : `pb-20 lg:pb-0 ${collapsed ? "lg:pl-14" : "lg:pl-56"}`}`}>
      {children}
    </div>
  );
}
