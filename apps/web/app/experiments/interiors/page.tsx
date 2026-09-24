import type { Metadata } from "next";
import { Rooms } from "./Rooms";

export const metadata: Metadata = { title: "Interiors · Unwatched experiments" };

/** Every kind of room the island draws, by day and by night, with people in them. */
export default function InteriorsPage() {
  return <Rooms />;
}
