import { notFound } from "next/navigation";
import HarborPreview from "./HarborPreview";

export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <HarborPreview />;
}
