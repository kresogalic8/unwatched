import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Feedback",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
