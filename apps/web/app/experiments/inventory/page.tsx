import { notFound } from "next/navigation";
import InventoryPreview from "./InventoryPreview";
export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <InventoryPreview/>;
}
