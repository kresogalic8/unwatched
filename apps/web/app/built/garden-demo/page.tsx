import Link from "next/link";
import { CommunityProjects } from "@/components/CommunityProjects";
export const metadata = { title: "From a shared idea to a shared harvest", description: "A reproducible scripted engine scenario: neighbors exchange experience, contribute and grow food. Separate from the live island." };
export default function GardenDemo() { return <main className="max-w-[1240px] mx-auto py-8"><nav className="px-5 flex justify-between"><Link href="/" className="display text-xl">unwatched</Link><Link href="/built" className="text-teal underline">Back to the live projects →</Link></nav><CommunityProjects demo /></main>; }
