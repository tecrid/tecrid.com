import {kasandrinosTestWorkspace} from '../../../lib/kasandrinos-test-workspace';
export const dynamic='force-dynamic';
export async function GET(request:Request){return kasandrinosTestWorkspace(request);}
export async function POST(request:Request){return kasandrinosTestWorkspace(request);}
