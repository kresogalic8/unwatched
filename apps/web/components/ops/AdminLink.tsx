"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
export function AdminLink() {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    let active = true;
    void api("/api/backoffice/session")
      .then(() => {
        if (active) setAllowed(true);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return allowed ? <Link href="/ops">Back office ↗</Link> : null;
}
