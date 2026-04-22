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
    <nav className="fixed inset-x-0 bottom-0 z-[100] border-t border-gray-800 bg-black/95 backdrop-blur supports-[padding:max(0px)]:pb-[max(env(safe-area-inset-bottom),0px)]">
      <div className="mx-auto w-full max-w-5xl">
        <div className="grid grid-cols-5">
          {items.map((item) => {
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
        </div>
      </div>
    </nav>
  );
}