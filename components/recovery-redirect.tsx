"use client";
import { useEffect } from "react";
export default function RecoveryRedirect() {
  useEffect(() => {
    if (window.location.pathname === "/reset-password") return;
    const params = new URLSearchParams(window.location.hash.slice(1));
    if (params.get("type") === "recovery")
      window.location.replace("/reset-password" + window.location.hash);
  }, []);
  return null;
}
