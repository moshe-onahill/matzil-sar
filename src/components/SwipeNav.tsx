"use client";

import { usePathname, useRouter } from "next/navigation";
import { useRef, useState } from "react";

const PAGES = ["/", "/incidents", "/responders", "/map"];
const THRESHOLD = 80;   // px needed to commit the swipe
const RESISTANCE = 0.35; // how much the page resists past the threshold

export default function SwipeNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const idx = PAGES.findIndex((p) => p === pathname);

  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const [dx, setDx] = useState(0);
  const [animating, setAnimating] = useState(false);

  function onTouchStart(e: React.TouchEvent) {
    if (idx === -1 || animating) return;
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    setDx(0);
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!touchStart.current || idx === -1 || animating) return;
    const rawDx = e.touches[0].clientX - touchStart.current.x;
    const rawDy = e.touches[0].clientY - touchStart.current.y;

    // Cancel if more vertical than horizontal
    if (Math.abs(rawDy) > Math.abs(rawDx)) {
      touchStart.current = null;
      return;
    }

    // Resist at edges
    const atStart = idx === 0 && rawDx > 0;
    const atEnd = idx === PAGES.length - 1 && rawDx < 0;
    const clampedDx = (atStart || atEnd) ? rawDx * RESISTANCE : rawDx;

    setDx(clampedDx);
  }

  function onTouchEnd() {
    if (!touchStart.current || idx === -1 || animating) return;
    touchStart.current = null;

    const target =
      dx < -THRESHOLD && idx < PAGES.length - 1 ? PAGES[idx + 1]
      : dx > THRESHOLD && idx > 0 ? PAGES[idx - 1]
      : null;

    if (target) {
      // Animate off-screen then navigate
      const direction = dx < 0 ? -1 : 1;
      setAnimating(true);
      setDx(direction * -window.innerWidth);
      setTimeout(() => {
        router.push(target);
        setDx(0);
        setAnimating(false);
      }, 220);
    } else {
      // Spring back
      setAnimating(true);
      setDx(0);
      setTimeout(() => setAnimating(false), 300);
    }
  }

  const style: React.CSSProperties = {
    transform: `translateX(${dx}px)`,
    transition: animating ? "transform 220ms cubic-bezier(0.25, 1, 0.5, 1)" : "none",
    willChange: "transform",
  };

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className="min-h-full overflow-hidden"
    >
      <div style={style} className="min-h-full">
        {children}
      </div>
    </div>
  );
}
