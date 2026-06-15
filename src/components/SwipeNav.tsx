"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const PAGES = ["/", "/incidents", "/responders", "/map"];
const THRESHOLD = 60;
const RESISTANCE = 0.3;

export default function SwipeNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const idx = PAGES.findIndex((p) => p === pathname);

  const containerRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const dxRef = useRef(0);
  const committed = useRef(false);
  const [dx, setDx] = useState(0);

  // Slide-in animation when arriving on a new page
  const [slideIn, setSlideIn] = useState(false);
  const [slideDir, setSlideDir] = useState(0);

  useEffect(() => {
    const dir = Number(sessionStorage.getItem("swipe-dir") || "0");
    if (dir !== 0) {
      sessionStorage.removeItem("swipe-dir");
      setSlideDir(dir);
      setSlideIn(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setSlideIn(false)));
    }
  }, [pathname]);

  // Register non-passive touch listeners so we can preventDefault
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function handleTouchStart(e: TouchEvent) {
      if (idx === -1) return;
      committed.current = false;
      dxRef.current = 0;
      setDx(0);
      touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }

    function handleTouchMove(e: TouchEvent) {
      if (!touchStart.current || idx === -1 || committed.current) return;
      const rawDx = e.touches[0].clientX - touchStart.current.x;
      const rawDy = e.touches[0].clientY - touchStart.current.y;

      // If more vertical than horizontal, bail out
      if (Math.abs(rawDy) > Math.abs(rawDx) * 0.9) {
        touchStart.current = null;
        dxRef.current = 0;
        setDx(0);
        return;
      }

      // Prevent Chrome's back/forward gesture
      e.preventDefault();

      const atStart = idx === 0 && rawDx > 0;
      const atEnd = idx === PAGES.length - 1 && rawDx < 0;
      const val = (atStart || atEnd) ? rawDx * RESISTANCE : rawDx;
      dxRef.current = val;
      setDx(val);
    }

    function handleTouchEnd() {
      if (!touchStart.current || idx === -1 || committed.current) return;
      touchStart.current = null;
      const val = dxRef.current;

      if (val < -THRESHOLD && idx < PAGES.length - 1) {
        committed.current = true;
        sessionStorage.setItem("swipe-dir", "-1");
        setDx(0);
        router.push(PAGES[idx + 1]);
      } else if (val > THRESHOLD && idx > 0) {
        committed.current = true;
        sessionStorage.setItem("swipe-dir", "1");
        setDx(0);
        router.push(PAGES[idx - 1]);
      } else {
        setDx(0);
      }
    }

    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [idx, router]);

  const style: React.CSSProperties = slideIn
    ? { transform: `translateX(${slideDir * 40}px)`, transition: "none", opacity: 0.7 }
    : dx !== 0
    ? { transform: `translateX(${dx}px)`, transition: "none" }
    : {
        transform: "translateX(0)",
        transition: "transform 280ms cubic-bezier(0.25, 1, 0.5, 1)",
        opacity: 1,
      };

  return (
    <div ref={containerRef} className="min-h-full">
      <div style={style} className="min-h-full">
        {children}
      </div>
    </div>
  );
}
