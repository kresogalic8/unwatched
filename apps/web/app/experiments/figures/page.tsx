import type { Metadata } from "next";
import { Figures } from "./Figures";

export const metadata: Metadata = { title: "Figures · Unwatched experiments" };

/** The figurines in their variety, lined up: children with their toys, the old with their sticks, each trade in its apron. */
export default function FiguresPage() {
  return <Figures />;
}
