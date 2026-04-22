"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/incidents", label: "Incidents", icon: "🚨" },
  { href: "/responders", label: "Responders", icon: "👥" },
  { href: "/map", label: "Map", icon: "🗺️" },
  { href: "/roster", label: "Roster", icon: "📋" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export default function AppBottomNav() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/incidents") {
      return pathname === "/incidents" || pathname.startsWith("/incidents/");
    }
    if (href === "/roster") {
      return pathname === "/roster" || pathname.startsWith("/roster/");
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-800 bg-black/95 backdrop-blur">
      <div className="mx-auto grid max-w-5xl grid-cols-5">
        {items.map((item) => {
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 px-2 py-3 text-xs transition ${
                active ? "text-red-400" : "text-gray-400 hover:text-white"
              }`}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}