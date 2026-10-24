import {getOriginalFetch} from 'vinext/shims/fetch-cache';

// Workers supports only manual/follow redirect modes. Private requests must
// never follow redirects with credentials or enter the framework fetch cache.
export async function privateFetchWith(nativeFetch:typeof fetch,input:Parameters<typeof fetch>[0],init?:Parameters<typeof fetch>[1]){
 const response:Response=await Reflect.apply(nativeFetch,globalThis,[input,{...init,redirect:'manual',cache:'no-store'}]);
 if(response.status>=300&&response.status<400)throw new Error('Private service redirects are not allowed.');
 return response;
}
export const privateFetch:typeof fetch=(input,init)=>privateFetchWith(getOriginalFetch(),input,init);
