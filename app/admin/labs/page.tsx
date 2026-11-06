import {cookies} from 'next/headers';
import {notFound,redirect} from 'next/navigation';
import {requireChatGPTUser} from '../../chatgpt-auth';
import {adminGate} from '../../../lib/admin-mfa';
import {labQueue} from '../../../lib/public-lab-applications';
import {ProductNav,ProductFooter} from '../../site-nav';
import {LabReview} from './review';
export const dynamic='force-dynamic';
export default async function Labs({searchParams}:{searchParams:Promise<{before?:string;status?:string}>}){
 const user=await requireChatGPTUser('/admin/labs');const token=(await cookies()).get('tecrid_admin_mfa')?.value;const gate=await adminGate(user,token?`tecrid_admin_mfa=${token}`:null);if(gate==='denied')notFound();if(gate!=='ok')redirect('/admin/security');
 const search=await searchParams;const query=new URLSearchParams();if(search.before)query.set('before',search.before);if(search.status)query.set('status',search.status);const page=await labQueue(user,query);
 return <main className="product-page admin-page"><ProductNav compact/><section style={{maxWidth:1000,margin:'2rem auto',padding:'0 1rem'}}><h1>Public laboratory applications</h1><p><a href="/admin/issuers">Issuer identity, scope and key checks</a></p><form method="get"><label>Status <select name="status" defaultValue={search.status||''}><option value="">All</option>{['PENDING','APPROVED','REJECTED'].map(s=><option key={s}>{s}</option>)}</select></label><button>Filter</button></form>{page.applications.map(a=><article key={a.id} style={{padding:'1.5rem 0',borderBottom:'1px solid #bbb'}}><h2>{a.lab_name}</h2><p>{a.status} · {a.contact_email}</p><p>{a.accreditation_body} · {a.accreditation_number}</p><p>{a.scope_metals}</p><a href={`/api/admin/lab-applications/${a.id}`}>Download private accreditation certificate</a>{a.status==='PENDING'&&<LabReview id={a.id}/>}</article>)}{!page.applications.length&&<p>No applications on this page.</p>}<nav aria-label="Queue pagination"><a href="/admin/labs">First page</a>{page.nextCursor&&<a style={{marginLeft:24}} href={`/admin/labs?${new URLSearchParams({before:page.nextCursor,...(search.status?{status:search.status}:{})})}`}>Next 25 applications</a>}</nav></section><ProductFooter/></main>;
}
