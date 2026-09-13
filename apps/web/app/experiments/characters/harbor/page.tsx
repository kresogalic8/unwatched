import { notFound } from "next/navigation";
import type { Metadata } from "next";
import HarborStudy from "./HarborStudy";
export const metadata: Metadata={title:"Our first Spine citizens",robots:{index:false,follow:false}};
export default function Page(){if(process.env.NODE_ENV!=="development")notFound();return <HarborStudy/>;}
