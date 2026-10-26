import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getVerifiedEmailSession } from "../../../lib/email-auth";
import { labTeamForUser } from "../../../lib/issuer-people";
import { TecAuthorizationError } from "../../../lib/tec";
import { TeamAction } from "./team-controls";
export const dynamic="force-dynamic";
export const metadata={title:"Laboratory people",robots:{index:false,follow:false}};
export default async function LabTeamPage({searchParams}:{searchParams:Promise<{lab?:string}>}){
 const identity=await getVerifiedEmailSession(new Headers(await headers()));if(!identity)redirect("/sign-in?return_to=/dashboard/team");
 const {lab:code}=await searchParams;
 let data:Awaited<ReturnType<typeof labTeamForUser>>;
 try{data=await labTeamForUser(identity.user,code);}catch(error){if(error instanceof TecAuthorizationError)notFound();throw error;}
 return <main className="product-page phone-review-page"><a href="/dashboard/settings">Settings</a><h1>Laboratory people</h1>
 <p>Each issuer needs their own confirmed laboratory email, approved membership, identity check, and device passkey.</p>
 <p>Government ID verification is awaiting an approved provider connection. Membership approval alone does not enable issuing. No ID documents are collected here.</p>
 <a href="/account/passkeys">Set up your device passkey</a>
 <section><h2>Request to join a laboratory</h2><TeamAction lab={data.lab?.issuerCode||""} action="request" label="Request membership"/></section>
 {data.ownRequests.length>0&&<section><h2>Your requests</h2>{data.ownRequests.map(person=><p key={person.id}>{person.id} · {person.status} · identity {person.identityStatus}</p>)}</section>}
 {data.lab&&<section><h2>{data.lab.name}</h2><p>{data.lab.issuerCode} · {data.lab.status} · verified domain {data.lab.verifiedEmailDomain||"pending review"}</p>
 {data.people.length?data.people.map(person=><article key={person.id} className="phone-review-facts"><h3>{person.displayName}</h3><p>{person.email}</p><p>Person {person.id}</p><p>Membership {person.status} · identity {person.identityStatus}</p>
 {data.canManage&&person.status==="requested"&&<TeamAction lab={data.lab!.issuerCode} personId={person.id} action="approve" label="Approve membership"/>}
 {data.canManage&&["requested","active"].includes(person.status)&&<TeamAction lab={data.lab!.issuerCode} personId={person.id} action="remove" label="Remove person and revoke keys"/>}
 {data.isIcsAdmin&&person.status!=="suspended"&&<TeamAction lab={data.lab!.issuerCode} personId={person.id} action="suspend" label="Suspend person and revoke keys"/>}
 </article>):<p>No named issuers have requested membership yet.</p>}
 {data.isIcsAdmin&&data.lab.status!=="suspended"&&<TeamAction lab={data.lab.issuerCode} action="suspend_lab" label="Suspend laboratory and revoke all keys"/>}</section>}
 <section><h2>Recent issued records</h2>{data.issuedRecords.map(record=><p key={record.identifier}><a href={`/records/${encodeURIComponent(record.identifier)}`}>{record.identifier}</a><br/>{record.issuerDisplayName||"Historical issuer not recorded"} · {record.issuerPersonId||"Unknown"}<br/>{record.issuedAt} · API key {record.issuingApiKeyId||"Issued in account"}</p>)}</section>
 </main>;
}
