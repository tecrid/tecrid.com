export function safeReturnPath(value:unknown,fallback='/dashboard'){
 if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//')||value.includes('\\'))return fallback;
 try{const u=new URL(value,'https://tecrid.com');if(u.origin!=='https://tecrid.com'||/^\/(api|sign-in|sign-out|signin-with-chatgpt|signout-with-chatgpt|callback)(\/|$)/.test(u.pathname))return fallback;return u.pathname+u.search+u.hash;}catch{return fallback;}
}
