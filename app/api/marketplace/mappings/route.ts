import {getChatGPTUser} from "../../../chatgpt-auth";
import {reviewMarketplaceMapping} from "../../../../lib/marketplace-stream";
import {rejectCrossOriginWrite} from "../../../../lib/request-security";
import {TecAuthorizationError,TecInputError} from "../../../../lib/tec";
export async function POST(request:Request){
 const cross=rejectCrossOriginWrite(request);if(cross)return cross;
 const user=await getChatGPTUser();if(!user)return Response.json({error:"Sign in is required."},{status:401});
 try{return Response.json({result:await reviewMarketplaceMapping(user,await request.json())});}
 catch(error){const known=error instanceof TecAuthorizationError||error instanceof TecInputError;return Response.json({error:known?error.message:"Mapping review failed."},{status:known?error.status:500});}
}
