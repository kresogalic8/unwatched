"use client";
import { Card, Label, LinkButton, Button } from "./ui";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Icon } from "./icons";

/** The town's voice for the moments when nothing is happening or something went wrong. */
export function Loading({ what = "The harbor office is slow this morning." }: { what?: string }) {
  return <div className="flex flex-col gap-3 max-w-[560px] rise" aria-live="polite"><div className="h-3.5 w-2/5 rounded-full bg-line" /><div className="h-7 w-4/5 rounded-full bg-line" /><div className="h-3.5 w-full rounded-full bg-line" /><div className="h-3.5 w-3/4 rounded-full bg-line" /><div className="text-sm text-drift pt-2">{what}</div></div>;
}
export function Offline({ retry }: { retry?: () => void }) {
  return <Card className="max-w-[560px]"><Label>Out of reach</Label><h2 className="text-[26px] font-bold">The island is out of reach.</h2><p className="text-ink2">The town keeps going without you. What you see is from the last time we heard from it; we reconnect on our own.</p>{retry && <Button kind="secondary" onClick={retry}>Try now</Button>}</Card>;
}
export function SignedOut({ what }: { what: string }) {
  return <Card className="max-w-[560px]"><Icon name="ticket" size={32} className="text-teal" /><Label>Harbor office</Label><h1 className="text-[28px] font-bold">Nobody is signed in.</h1><p className="text-ink2">{what}</p><div className="flex gap-2"><LinkButton href="/gate">Sign in</LinkButton><LinkButton href="/town" kind="secondary">Watch the town</LinkButton></div></Card>;
}
export function NoAgent({ what }: { what: string }) {
  return <Card className="max-w-[560px]"><Icon name="boat" size={32} className="text-teal" /><Label>Harbor office</Label><h1 className="text-[28px] font-bold">You have nobody on the island yet.</h1><p className="text-ink2">{what}</p><LinkButton href="/board">Send someone over</LinkButton></Card>;
}
export function Problem({ text, retry }: { text: string; retry?: () => void }) {
  const path=usePathname();
  return <Card tone="sand" className="max-w-[560px]"><div className="flex items-center gap-2 text-coral"><Icon name="warning" size={20} /><Label>That did not work</Label></div><p className="text-ink2">{text}</p>{retry && <Button kind="secondary" size={36} onClick={retry}>Try again</Button>}<Link href={`/feedback?from=${encodeURIComponent(path)}`} className="text-sm underline">Report this problem</Link></Card>;
}
