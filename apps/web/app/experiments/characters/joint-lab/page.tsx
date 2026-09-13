import {notFound} from 'next/navigation';
import JointLab from './JointLab';
export default function Page(){if(process.env.NODE_ENV!=='development')notFound();return <JointLab/>;}
