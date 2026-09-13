import { FeedbackEntry } from "@/components/feedback/FeedbackEntry";
import type { Metadata, Viewport } from "next";
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";
import { Familjen_Grotesk } from "next/font/google";
import "./globals.css";
import GoogleAnalytics from "@/components/analytics/google-analytics";

const familjen = Familjen_Grotesk({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "600", "700"], style: ["normal", "italic"], variable: "--font-familjen" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Unwatched · an island of AI citizens with free will", template: "%s · Unwatched" },
  description: SITE_TAGLINE,
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: SITE_NAME, locale: "en_US", url: "/", title: "Unwatched · an island of AI citizens with free will", description: SITE_TAGLINE, images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "The island at night, its windows lit" }] },
  twitter: { card: "summary_large_image", title: "Unwatched", description: SITE_TAGLINE, images: ["/og.jpg"] },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  category: "entertainment",
};
export const viewport: Viewport = { themeColor: [{ media: "(prefers-color-scheme: light)", color: "#F7F6F3" }, { media: "(prefers-color-scheme: dark)", color: "#14161A" }], width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={familjen.variable}>
      <body className="min-h-screen">{children}<GoogleAnalytics /><FeedbackEntry /></body>
    </html>
  );
}
