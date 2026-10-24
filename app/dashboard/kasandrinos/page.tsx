import {ProductNav,ProductFooter} from '../../site-nav';
import {KasandrinosTestWorkspace} from './workspace';
export const dynamic='force-dynamic';
export const metadata={title:'Kasandrinos TEST records · TEC Registry',description:'Manage the eight Kasandrinos TEST report permissions. Light Labs approval and signature pending.'};
export default function KasandrinosTestPage(){return <main className="product-page kas-access-page"><ProductNav compact/><header className="dashboard-header"><div><p className="section-kicker light">Kasandrinos · TEST workspace</p><h1>Eight digital cards.<br/>Access you control.</h1><p>Approve or revoke digital TECRID card access for specific recipients. Light Labs approval and signature remain pending.</p></div><span className="workspace-code">Profile <strong>KASTEST · TEST</strong></span></header><KasandrinosTestWorkspace/><ProductFooter/></main>;}
