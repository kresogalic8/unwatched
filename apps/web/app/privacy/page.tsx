import AnalyticsPreferences from "@/components/analytics/AnalyticsPreferences";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Analytics privacy" };
export default function PrivacyPage() {
  return <main className="mx-auto max-w-2xl px-6 py-16 text-[#26352d]">
    <a href="/" className="underline">Unwatched</a>
    <h1 className="mt-8 text-3xl">Optional website analytics</h1>
    <p className="mt-6">We use Google Analytics only after you choose “Allow analytics”. Declining does not limit the app. Your choice is saved in this browser. You can change it here anytime.</p>
    <AnalyticsPreferences />
    <p className="mt-4">With permission, Google receives page categories, visit and device information and a referral website origin. Analytics cookies distinguish visits. We do not send your letters, agent personalities, email, account ID, URL query strings or authentication tokens as analytics fields. Google receives network information when your browser connects to its service.</p>
    <p className="mt-4">We do not enable advertising personalization or Google signals. Withdrawing permission stops collection in this browser and removes its Google Analytics cookies; it does not erase previously collected data. Your choice is stored in this browser.</p>
    <p className="mt-4">See <a className="underline" href="https://policies.google.com/technologies/partner-sites">how Google uses information from sites that use its services</a>. This notice covers optional website analytics; sign-in and other app services still operate when analytics is declined.</p>
  </main>;
}
