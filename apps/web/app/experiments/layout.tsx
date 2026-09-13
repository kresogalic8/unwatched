import { notFound } from "next/navigation";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Unwatched experiments", robots: { index: false, follow: false } };
export default function ExperimentsLayout({children}:{children:React.ReactNode}) {
  if(process.env.NODE_ENV !== "development") notFound();
  return children;
}
