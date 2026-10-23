import {protectedTestReport} from '../../../../../lib/test-report-access';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{identifier:string}>}){return protectedTestReport(request,(await params).identifier,'card');}
