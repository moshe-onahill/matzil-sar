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

  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const [dx, setDx] = useState(0);
  const [entering, setEntering] = useState(false);
  const [enterDir, setEnterDir] = useState(0); // -1 = from right, +1 = from left
  const committed = useRef(false);

  // Slide-in animation when page changes
  useEffect(() => {
    const dir = Number(sessionStorage.getItem("swipe-dir") || "0");
    if (dir !== 0) {
      sessionStorage.removeItem("swipe-dir");
      setEnterDir(dir);
      setEntering(true);
      // Trigger animation on next frame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setEntering(false));
      });
    }
  }, [pathname]);

  function onTouchStart(e: React.TouchEvent) {
    if (idx === -1) return;
    committed.current = false;
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    setDx(0);
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!touchStart.current || idx === -1 || committed.current) return;
    const rawDx = e.touches[0].clientX - touchStart.current.x;
    const rawDy = e.touches[0].clientY - touchStart.current.y;

    if (Math.abs(rawDy) > Math.abs(rawDx) * 0.8) {
      touchStart.current = null;
      setDx(0);
      return;
    }

    const atStart = idx === 0 && rawDx > 0;
    const atEnd = idx === PAGES.length - 1 && rawDx < 0;
    setDx((atStart || atEnd) ? rawDx * RESISTANCE : rawDx);
  }

  function onTouchEnd() {
    if (!touchStart.current || idx === -1 || committed.current) return;
    touchStart.current = null;

    if (dx < -THRESHOLD && idx < PAGES.length - 1) {
      committed.current = true;
      sessionStorage.setItem("swipe-dir", "-1");
      setDx(0);
      router.push(PAGES[idx + 1]);
    } else if (dx > THRESHOLD && idx > 0) {
      committed.current = true;
      sessionStorage.setItem("swipe-dir", "1");
      setDx(0);
      router.push(PAGES[idx - 1]);
    } else {
      setDx(0);
    }
  }

  // Page-follow style during drag — no transition
  // Slide-in style when entering — transition from offset to 0
  const style: React.CSSProperties = entering
    ? {
        transform: `translateX(${enterDir * 100}%)`,
        transition: "none",
      }
    : dx !== 0
    ? { transform: `translateX(${dx}px)`, transition: "none" }
    : {
        transform: "translateX(0)",
        transition: entering ? "none" : "transform 280ms cubic-bezier(0.25, 1, 0.5, 1)",
      };

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className="min-h-full"
      style={{ overflow: dx !== 0 ? "hidden" : undefined }}
    >
      <div style={style} className="min-h-full">
        {children}
      </div>
    </div>
  );
}
