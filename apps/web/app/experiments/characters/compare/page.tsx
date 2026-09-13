import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Comparison from "./Comparison";
export const metadata: Metadata = { title:"Character lab · Three ways to bring them to life", robots:{index:false,follow:false} };
export default function Page(){ if(process.env.NODE_ENV!=="development") notFound(); return <Comparison/>; }
