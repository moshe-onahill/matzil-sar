"use client";

import { useEffect, useState } from "react";

export default function NavContentWrapper({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem("nav-collapsed") === "1");
    function onStorage(e: StorageEvent) {
      if (e.key === "nav-collapsed") setCollapsed(e.newValue === "1");
    }
    window.addEventListener("storage", onStorage);
    // Also listen for same-tab changes
    function onNavToggle(e: Event) {
      setCollapsed((e as CustomEvent).detail === "1");
    }
    window.addEventListener("nav-toggle", onNavToggle);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("nav-toggle", onNavToggle);
    };
  }, []);

  return (
    <div className={`min-h-screen w-full overflow-x-hidden pb-20 lg:pb-0 transition-[padding] duration-200 ${collapsed ? "lg:pl-14" : "lg:pl-56"}`}>
      {children}
    </div>
  );
}
