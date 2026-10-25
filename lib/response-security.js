export function prepareResponseSecurity(request){
 const nonce=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
 const policy=`default-src 'self'; script-src 'self' 'nonce-${nonce}'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`;
 const headers=new Headers(request.headers);
 // Framework-native nonce propagation; never trust a client-supplied policy.
 headers.set('content-security-policy',policy);headers.delete('content-security-policy-report-only');
 return {request:new Request(request,{headers}),policy};
}
export function protectResponse(response,request,policy){
 const headers=new Headers(response.headers),html=headers.get('content-type')?.includes('text/html'),api=new URL(request.url).pathname.startsWith('/api/');
 if(html||api||request.headers.has('cookie')||request.headers.has('authorization')){
  headers.set('cache-control','private, no-store, max-age=0');
  const vary=new Set((headers.get('vary')||'').split(',').map(v=>v.trim()).filter(Boolean));vary.add('Cookie');vary.add('Authorization');headers.set('vary',[...vary].join(', '));
  headers.set('referrer-policy','no-referrer');headers.set('x-content-type-options','nosniff');
 }
 if(html){headers.set('content-security-policy',policy);headers.set('x-frame-options','DENY');}
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
