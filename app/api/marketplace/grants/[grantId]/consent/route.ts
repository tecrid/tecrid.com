import {getChatGPTUser} from "../../../../../chatgpt-auth";
import {setMarketplaceGrantSettings} from "../../../../../../lib/marketplace-stream";
import {rejectCrossOriginWrite} from "../../../../../../lib/request-security";
import {TecAuthorizationError,TecInputError} from "../../../../../../lib/tec";
export async function POST(request:Request,{params}:{params:Promise<{grantId:string}>}){
 const cross=rejectCrossOriginWrite(request);if(cross)return cross;
 const user=await getChatGPTUser();if(!user)return Response.json({error:"Sign in is required."},{status:401});
 try{return Response.json({result:await setMarketplaceGrantSettings(user,(await params).grantId,await request.json())});}
 catch(error){const known=error instanceof TecAuthorizationError||error instanceof TecInputError;return Response.json({error:known?error.message:"Grant consent failed."},{status:known?error.status:500});}
}
