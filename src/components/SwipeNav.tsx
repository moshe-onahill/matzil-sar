"use client";

import { usePathname, useRouter } from "next/navigation";
import { useRef } from "react";

const PAGES = ["/", "/incidents", "/responders", "/map"];
const THRESHOLD = 60;   // min horizontal px to count as a swipe
const RATIO = 1.5;      // horizontal must be this times more than vertical

export default function SwipeNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  // Only activate on pages that are in the swipe sequence
  const idx = PAGES.findIndex((p) => p === pathname);

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (!touchStart.current || idx === -1) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    touchStart.current = null;

    if (Math.abs(dx) < THRESHOLD || Math.abs(dx) < Math.abs(dy) * RATIO) return;

    if (dx < 0 && idx < PAGES.length - 1) {
      router.push(PAGES[idx + 1]);
    } else if (dx > 0 && idx > 0) {
      router.push(PAGES[idx - 1]);
    }
  }

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      className="min-h-full"
    >
      {children}
    </div>
  );
}
