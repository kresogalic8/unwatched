import {notFound} from 'next/navigation';
import HarborStudy from '../HarborStudy';
export default function Page(){if(process.env.NODE_ENV!=='development')notFound();return <HarborStudy painted candidate/>;}
