import {sampleLabReports,sampleLabReference} from "../../../../../lib/sample-lab";
export async function GET(){return Response.json({sandbox:true,productionAuthority:false,reports:sampleLabReports.map(r=>sampleLabReference(r.testIdentifier))},{headers:{"cache-control":"no-store"}});}
