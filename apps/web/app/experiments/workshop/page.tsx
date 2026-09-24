import { notFound } from 'next/navigation';
import Workshop from './Workshop';
export default function Page(){if(process.env.NODE_ENV!=='development')notFound();return <Workshop/>;}
