import {and,desc,eq} from "drizzle-orm";
import {getChatGPTUser} from "../../../chatgpt-auth";
import {getDb} from "../../../../db";
import {evidenceDeliveries,marketplaceStreamJobs} from "../../../../db/schema";
import {requireOrganizationAdmin,TecAuthorizationError} from "../../../../lib/tec";
export async function GET(){
 const user=await getChatGPTUser();if(!user)return Response.json({error:"Sign in is required."},{status:401});
 try{
  const {organization}=await requireOrganizationAdmin(user);
  const holds=await getDb().select({deliveryId:marketplaceStreamJobs.deliveryId,reason:marketplaceStreamJobs.heldReason,processedAt:marketplaceStreamJobs.processedAt}).from(marketplaceStreamJobs).innerJoin(evidenceDeliveries,eq(evidenceDeliveries.id,marketplaceStreamJobs.deliveryId)).where(and(eq(evidenceDeliveries.controllerOrganizationId,organization.id))).orderBy(desc(marketplaceStreamJobs.id)).limit(100);
  return Response.json({holds:holds.filter(h=>h.reason)},{headers:{"cache-control":"private, no-store"}});
 }catch(error){return Response.json({error:"Controller administration is required."},{status:error instanceof TecAuthorizationError?403:500});}
}
