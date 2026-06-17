"use client";
import { useEffect } from "react";

export default function ThemeApplier() {
  useEffect(() => {
    const apply = () => {
      const light = localStorage.getItem("theme") === "light";
      document.documentElement.classList.toggle("light-mode", light);
    };
    apply();
    window.addEventListener("storage", apply);
    return () => window.removeEventListener("storage", apply);
  }, []);
  return null;
}
