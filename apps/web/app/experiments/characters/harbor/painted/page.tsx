import {notFound} from 'next/navigation';
import type {Metadata} from 'next';
import HarborStudy from '../HarborStudy';
export const metadata:Metadata={title:'Mara · Painted character in motion',robots:{index:false,follow:false}};
export default function Page(){if(process.env.NODE_ENV!=='development')notFound();return <HarborStudy painted/>;}
