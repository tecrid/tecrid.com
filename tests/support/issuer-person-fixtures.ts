import type { ChatGPTUser } from "../../app/chatgpt-auth";
import { syntheticReviewerSession } from "./passkey-fixtures";
// Disposable test database only. Production exposes no identity-approval setter.
export async function seedSyntheticIssuerPerson(db:ReturnType<typeof import("../../db").getRawDb>,organizationId:string,user:ChatGPTUser){
 await syntheticReviewerSession(user);
 const authId=user.userId.slice(6);
 const personId="person_synthetic_"+authId.replaceAll("-","_");
 await db.prepare("UPDATE organization_members SET email=? WHERE organization_id=? AND user_id=?").bind(user.email,organizationId,user.userId).run();
 await db.prepare("INSERT INTO issuer_people(id,organization_id,user_id,email,email_domain,display_name,status,identity_status,identity_verified_at,approved_by_user_id,approved_at) VALUES(?,?,?,?,?,?,'active','verified',CURRENT_TIMESTAMP,?,CURRENT_TIMESTAMP)")
  .bind(personId,organizationId,user.userId,user.email,user.email.split("@")[1],user.displayName,user.userId).run();
 return personId;
}
