"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import s from "./feedback.module.css";
export function FeedbackEntry() {
  const path = usePathname();
  if (path.startsWith("/ops") || path.startsWith("/feedback")) return null;
  return (
    <Link
      className={s.entry}
      href={`/feedback?from=${encodeURIComponent(path)}`}
      aria-label="Give feedback or report a problem"
    >
      Feedback <span aria-hidden="true">↗</span>
    </Link>
  );
}
