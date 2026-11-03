import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Shop Your Way · Happy Customer, Happy System',description:'A calmer shopping companion. Your needs, your pace, your choice.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
