import { notFound } from "next/navigation";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Unwatched experiments", robots: { index: false, follow: false } };
export default function ExperimentsLayout({children}:{children:React.ReactNode}) {
  // development only; the visual regression build opts in (UW_EXPERIMENTS=1, see playwright.config.ts) to photograph the rooms and the figures
  if(process.env.NODE_ENV !== "development" && process.env.UW_EXPERIMENTS !== "1") notFound();
  return children;
}
