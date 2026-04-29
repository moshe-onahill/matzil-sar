"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const mainItems = [
  { href: "/incidents", label: "Incidents", icon: "🚨" },
  { href: "/responders", label: "Units", icon: "👥" },
  { href: "/map", label: "Map", icon: "🗺️" },
  { href: "/notifications", label: "Alerts", icon: "🔔" },
];

const moreItems = [
  { href: "/events", label: "Events", icon: "📅" },
  { href: "/roster", label: "Roster", icon: "🧑" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export default function AppBottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  function isActive(href: string) {
    if (href === "/incidents") {
      return pathname === "/incidents" || pathname.startsWith("/incidents/");
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const moreActive = moreItems.some((item) => isActive(item.href));

  return (
    <>
      {moreOpen && (
        <div className="fixed bottom-[76px] right-3 z-[110] w-48 rounded-xl border border-gray-800 bg-gray-950 p-2 shadow-xl">
          {moreItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMoreOpen(false)}
              className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm ${
                isActive(item.href)
                  ? "bg-red-950 text-red-300"
                  : "text-gray-300 hover:bg-gray-900"
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-[100] border-t border-gray-800 bg-black/95 backdrop-blur supports-[padding:max(0px)]:pb-[max(env(safe-area-inset-bottom),0px)]">
        <div className="mx-auto w-full max-w-5xl">
          <div className="grid grid-cols-5">
            {mainItems.map((item) => {
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex min-h-[68px] flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] transition ${
                    active ? "text-red-400" : "text-gray-400 hover:text-white"
                  }`}
                >
                  <span className="text-lg leading-none">{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}

            <button
              onClick={() => setMoreOpen((v) => !v)}
              className={`flex min-h-[68px] flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] transition ${
                moreActive || moreOpen
                  ? "text-red-400"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <span className="text-lg leading-none">☰</span>
              <span className="truncate">More</span>
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}