import { BuildingFilm } from "@/components/BuildingFilm";
export const metadata = { title: "A place they built", description: "Who started it, who helped, and what they built. Follow the recorded construction of a place on the island." };
export default async function BuildingPage({ params, searchParams }: { params: Promise<{place:string}>; searchParams: Promise<{through?:string}> }) { const {place}=await params; const q=await searchParams; return <BuildingFilm key={`${place}:${q.through ?? "latest"}`} place={place} />; }
