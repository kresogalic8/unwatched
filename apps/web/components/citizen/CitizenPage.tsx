"use client";
import Link from "next/link";
import { ExploreHeader } from "@/components/explore/ExplorePage";
import theme from "@/components/explore/explore.module.css";
import s from "./citizen.module.css";

export function CitizenPage({
  children,
  signedIn = false,
}: {
  children: React.ReactNode;
  signedIn?: boolean;
}) {
  return (
    <main className={`${theme.page} ${s.page}`}>
      <a className={theme.skip} href="#citizen-content">
        Skip to content
      </a>
      <ExploreHeader />
      <div id="citizen-content" className={s.content}>
        {children}
      </div>
      <footer className={theme.footer}>
        <Link href="/town">Back to the island</Link>
        <span>A life, as it happens.</span>
      </footer>
    </main>
  );
}
