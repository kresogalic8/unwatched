import type { Metadata } from "next";
import { NewLooks } from "./NewLooks";

export const metadata: Metadata = { title: "New looks · Unwatched experiments" };

/** New houses and new people for the island, beside the ones it has, on a street and on a model sheet. */
export default function NewLooksPage() {
  return <NewLooks />;
}
