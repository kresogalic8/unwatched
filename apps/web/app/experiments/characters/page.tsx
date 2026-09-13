import type { Metadata } from "next";
import Encounter from "./Encounter";
export const metadata: Metadata = { title: "A small encounter · Motion study", robots: { index: false, follow: false } };
export default function Page() { return <Encounter />; }
