"use client";
import { Icon as ArrowIcon } from "@/components/icons";
import Link from "next/link";
import { usePathname } from "next/navigation";
import s from "./feedback.module.css";
export function FeedbackEntry() {
  const path = usePathname();
  if (path === "/board" || path.startsWith("/board/") || path === "/experiments/another-life" || path === "/town" || path.startsWith("/ops") || path.startsWith("/feedback")) return null;
  return (
    <Link
      className={s.entry}
      href={`/feedback?from=${encodeURIComponent(path)}`}
      aria-label="Give feedback or report a problem"
    >
      <span className={s.entryLabel}>Feedback</span><ArrowIcon name="letter" size={20} />
    </Link>
  );
}
