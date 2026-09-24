import type { Metadata } from "next";
import { WorldStyles } from "./WorldStyles";

export const metadata: Metadata = { title: "World styles · Unwatched experiments" };

/** Two directions for the look of the world, side by side with the one that ships, on the same live scene. */
export default function WorldStylesPage() {
  return <WorldStyles />;
}
